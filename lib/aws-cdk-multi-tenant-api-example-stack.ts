import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';

export class MultiTenantApiGatewayExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const testFunction = new lambda.NodejsFunction(this, 'my-function');

    const api = new apigw.LambdaRestApi(this, 'RestApi', {
      handler: testFunction,
      cloudWatchRole: true,
      proxy: false,
    });

    const resource = api.root.addResource('items');
    resource.addMethod('GET', api.root.defaultIntegration, {
      authorizationType: apigw.AuthorizationType.IAM,
    });
  }
}
