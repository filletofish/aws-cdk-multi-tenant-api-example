import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { Sha256 } from '@aws-crypto/sha256-js';
import { fetch } from 'cross-fetch';
import * as AWS from 'aws-sdk';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const region = process.env.CDK_DEFAULT_REGION!;
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const account = process.env.CDK_DEFAULT_ACCOUNT!;

const url = new URL('https://rdi3z6scy2.execute-api.eu-west-1.amazonaws.com/prod/items');

const createSignerObj = async (): Promise<SignatureV4> => {
  const sts = new AWS.STS();
  const assumeRoleResponse = await sts
    .assumeRole({
      RoleArn: `arn:aws:iam::${account}:role/rest-api-client-payment-service-role`,
      RoleSessionName: 'AssumedRoleSession',
    })
    .promise();

  const assumedCredentials = assumeRoleResponse.Credentials;

  return new SignatureV4({
    credentials: {
      accessKeyId: assumedCredentials?.AccessKeyId || '',
      secretAccessKey: assumedCredentials?.SecretAccessKey || '',
      sessionToken: assumedCredentials?.SessionToken || '',
    },
    service: 'execute-api',
    region: region,
    sha256: Sha256,
  });
};

const sendSampleRequest = async () => {
  const request = new HttpRequest({
    hostname: url.hostname,
    path: url.pathname,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      host: url.hostname,
    },
  });

  const signer = await createSignerObj();

  const { headers, body, method } = await signer.sign(request);
  const result = await fetch(url, {
    headers,
    body,
    method,
  });

  if (!result.ok) {
    console.error(result);
    return;
  }

  console.log(await result.json());
};

sendSampleRequest();

// const signed = sign({
//   method: 'GET',
//   service: 'apigateway',
//   region: region,
//   host,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// }) as SignedRequest;

// axios({
//   ...signed,
//   url: apiGatewayInvokeUrl,
//   data: { test: 'aws4 message' },
// })
//   .then((response) => {
//     console.log(response);
//   })
//   .catch((error) => {
//     console.error('Something went wrong: ', error);
//   });
