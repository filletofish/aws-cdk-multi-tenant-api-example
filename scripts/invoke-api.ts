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

const createSignerObj = async (clientName: string): Promise<SignatureV4> => {
  const clientRoleArn = `arn:aws:iam::${account}:role/rest-api-client-${clientName}-role`;
  console.log(`Assuming role ${clientRoleArn}.`);

  const sts = new AWS.STS();
  const assumeRoleResponse = await sts
    .assumeRole({
      RoleArn: clientRoleArn,
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

const sendSampleRequests = async (clientName: string) => {
  const request = new HttpRequest({
    hostname: url.hostname,
    path: url.pathname,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      host: url.hostname,
    },
  });

  const signer = await createSignerObj(clientName);

  const { headers, body, method } = await signer.sign(request);

  const numberOfRequests = 10;
  console.log(`Sending ${numberOfRequests} of requests to api.`);

  [...Array(numberOfRequests)].forEach(async (_, i) => {
    const result = await fetch(url, {
      headers,
      body,
      method,
    });

    if (!result.ok) {
      console.error(`Client ${clientName} request ${i}: failed with error: ${JSON.stringify(await result.json())}`);
      return;
    }

    console.log(`Client ${clientName} request ${i} succeeded with reply: ${JSON.stringify(await result.json())}`);
  });
};

sendSampleRequests('payment-service');
sendSampleRequests('order-service');
