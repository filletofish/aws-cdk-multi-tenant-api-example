import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logsd from 'aws-cdk-lib/aws-logs-destinations';

interface ApiClientConfig {
  name: string;
  awsAccounts: string[];
  rateLimit: number;
  burstLimit: number;
}

const apiClients: ApiClientConfig[] = [
  {
    name: 'payment-service',
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    awsAccounts: [process.env.CDK_DEFAULT_ACCOUNT!],
    rateLimit: 10,
    burstLimit: 2,
  },
  {
    name: 'order-service',
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    awsAccounts: [process.env.CDK_DEFAULT_ACCOUNT!],
    rateLimit: 1,
    burstLimit: 1,
  },
];

export class MultiTenantApiExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const apiFunction = new lambda.NodejsFunction(this, 'api-function', {
      functionName: 'multi-tenant-api-function',
    });

    const accessLogsGroup = new logs.LogGroup(this, 'RestApiLogs', {
      logGroupName: 'multi-tenant-api-access-logs',
    });

    const api = new apigw.LambdaRestApi(this, 'RestApi', {
      handler: apiFunction,
      cloudWatchRole: true,
      proxy: false,
      deployOptions: {
        accessLogFormat: this.apiGatewayAccessLoggingFormat(),
        accessLogDestination: new apigw.LogGroupLogDestination(accessLogsGroup),
      },
      endpointExportName: 'MultiTenantApiEndpoint',
    });

    this.createPerClientCountMetricFilter(accessLogsGroup);
    this.createApiAccessLogProcessor(accessLogsGroup);

    const resource = api.root.addResource('items');
    const getItemsMethod = resource.addMethod('GET', api.root.defaultIntegration, {
      authorizationType: apigw.AuthorizationType.IAM,
      apiKeyRequired: true,
    });

    const allowInvokeApiPolicy = new iam.Policy(this, 'AllowInvokeApi', {
      statements: [
        new iam.PolicyStatement({
          actions: ['execute-api:Invoke'],
          effect: iam.Effect.ALLOW,
          resources: [getItemsMethod.methodArn],
        }),
      ],
    });

    apiClients.forEach((apiClient) => this.setupApiClient(allowInvokeApiPolicy, api, apiClient));
  }

  private setupApiClient(allowInvokeApiPolicy: iam.Policy, api: apigw.RestApi, apiClient: ApiClientConfig) {
    const clientAccountPrincipals = apiClient.awsAccounts.map((acc) => new iam.AccountPrincipal(acc));
    const role = new iam.Role(this, 'MultiTenantApiClient-' + apiClient.name + '-Role', {
      roleName: `MultiTenantApiClient-${apiClient.name}-role`,
      assumedBy: new iam.CompositePrincipal(...clientAccountPrincipals),
    });
    role.attachInlinePolicy(allowInvokeApiPolicy);

    const plan = api.addUsagePlan('MultiTenantApiUsagePlan-' + apiClient.name, {
      name: apiClient.name + '-plan',
      throttle: {
        rateLimit: apiClient.rateLimit,
        burstLimit: apiClient.burstLimit,
      },
    });

    plan.addApiStage({
      stage: api.deploymentStage,
    });

    const key = api.addApiKey('MultiTenantApiKey-' + apiClient.name, {
      apiKeyName: `key-${apiClient.name}`,
      value: `api-key-${apiClient.name}`,
    });
    plan.addApiKey(key);
  }

  private createPerClientCountMetricFilter(accessLogsGroup: logs.LogGroup) {
    const metricNamespace = 'MultiTenantApiMetricFilter';

    new logs.MetricFilter(this, 'MultiTenantApiCountMetricFilter', {
      logGroup: accessLogsGroup,
      filterPattern: logs.FilterPattern.exists('$.userArn'),
      metricNamespace: metricNamespace,
      metricName: 'Count',
      metricValue: '1',
      unit: cloudwatch.Unit.COUNT,
      dimensions: {
        client: '$.userArn',
        method: '$.httpMethod',
        path: '$.path',
      },
    });

    new logs.MetricFilter(this, 'MultiTenantApiLatencyMetricFilter', {
      logGroup: accessLogsGroup,
      filterPattern: logs.FilterPattern.exists('$.userArn'),
      metricNamespace: metricNamespace,
      metricName: 'Latency',
      metricValue: '$.responseLatency',
      unit: cloudwatch.Unit.MILLISECONDS,
      dimensions: {
        client: '$.userArn',
        method: '$.httpMethod',
        path: '$.path',
      },
    });

    new logs.MetricFilter(this, 'MultiTenantApi4XXErrorMetricFilter', {
      logGroup: accessLogsGroup,
      filterPattern: logs.FilterPattern.literal('{ ($.status = 4**) && ($.userArn = "*") }'),
      metricNamespace: metricNamespace,
      metricName: '4XXError',
      metricValue: '1',
      unit: cloudwatch.Unit.COUNT,
      dimensions: {
        client: '$.userArn',
        method: '$.httpMethod',
        path: '$.path',
      },
    });

    new logs.MetricFilter(this, 'MultiTenantApi5XXErrorMetricFilter', {
      logGroup: accessLogsGroup,
      filterPattern: logs.FilterPattern.literal('{ ($.status = 5**) && ($.userArn = "*") }'),
      metricNamespace: metricNamespace,
      metricName: '5XXError',
      metricValue: '1',
      unit: cloudwatch.Unit.COUNT,
      dimensions: {
        client: '$.userArn',
        method: '$.httpMethod',
        path: '$.path',
      },
    });
  }

  private createApiAccessLogProcessor(accessLogsGroup: logs.LogGroup) {
    const logProcessingFunction = new lambda.NodejsFunction(this, 'log-processor-function', {
      functionName: 'multi-tenant-api-log-processor-function',
    });
    new logs.SubscriptionFilter(this, 'MultiTenantApiLogSubscriptionFilter', {
      logGroup: accessLogsGroup,
      destination: new logsd.LambdaDestination(logProcessingFunction),
      filterPattern: logs.FilterPattern.allEvents(),
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
