import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';

interface Client {
  name: string;
  awsAccounts: string[];
}

const apiClients: Client[] = [
  {
    name: 'payment-service',
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    awsAccounts: [process.env.CDK_DEFAULT_ACCOUNT!],
  },
];

export class MultiTenantApiGatewayExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const testFunction = new lambda.NodejsFunction(this, 'my-function');

    const accessLogsGroup = new logs.LogGroup(this, 'RestApiLogs', {
      logGroupName: 'example-rest-api-access-logs',
    });

    const api = new apigw.LambdaRestApi(this, 'RestApi', {
      handler: testFunction,
      cloudWatchRole: true,
      proxy: false,
      deployOptions: {
        accessLogFormat: this.apiGatewayAccessLoggingFormat(),
        accessLogDestination: new apigw.LogGroupLogDestination(accessLogsGroup),
      },
    });

    const resource = api.root.addResource('items');
    const getItemsMethod = resource.addMethod('GET', api.root.defaultIntegration, {
      authorizationType: apigw.AuthorizationType.IAM,
    });

    apiClients.forEach((apiClient) => {
      const clientAccountPrincipals = apiClient.awsAccounts.map((acc) => new iam.AccountPrincipal(acc));
      const role = new iam.Role(this, 'RestApiClient' + apiClient.name + 'Role', {
        roleName: `rest-api-client-${apiClient.name}-role`,
        assumedBy: new iam.CompositePrincipal(...clientAccountPrincipals),
      });

      role.attachInlinePolicy(
        new iam.Policy(this, 'AllowInvokeApi', {
          statements: [
            new iam.PolicyStatement({
              actions: ['execute-api:Invoke'],
              effect: iam.Effect.ALLOW,
              resources: [getItemsMethod.methodArn],
            }),
          ],
        })
      );
    });
  }

  private apiGatewayAccessLoggingFormat(): apigw.AccessLogFormat {
    // See https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html#context-variable-reference

    const formatObject = {
      requestId: '$context.requestId',
      extendedRequestId: '$context.extendedRequestId',
      apiId: '$context.apiId',
      resourceId: '$context.resourceId',
      domainName: '$context.domainName',
      stage: '$context.stage',
      path: '$context.path',
      resourcePath: '$context.resourcePath',
      httpMethod: '$context.httpMethod',
      protocol: '$context.protocol',
      accountId: '$context.identity.accountId',
      sourceIp: '$context.identity.sourceIp',
      user: '$context.identity.user',
      userAgent: '$context.identity.userAgent',
      userArn: '$context.identity.userArn',
      caller: '$context.identity.caller',
      cognitoIdentityId: '$context.identity.cognitoIdentityId',
      status: '$context.status',
      integration: {
        // The status code returned from an integration. For Lambda proxy integrations, this is the status code that your Lambda function code returns.
        status: '$context.integration.status',
        // For Lambda proxy integration, the status code returned from AWS Lambda, not from the backend Lambda function code.
        integrationStatus: '$context.integration.integrationStatus',
        // The error message returned from an integration
        // A string that contains an integration error message.
        error: '$context.integration.error',
        latency: '$context.integration.latency',
      },
      error: {
        responseType: '$context.error.responseType',
        message: '$context.error.message',
      },
      requestTime: '$context.requestTime',
      responseLength: '$context.responseLength',
      responseLatency: '$context.responseLatency',
    };
    const accessLogFormatString = JSON.stringify(formatObject);
    return apigw.AccessLogFormat.custom(accessLogFormatString);
  }
}
