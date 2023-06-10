import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { MultiTenantApiGatewayExampleStack } from '../lib/aws-cdk-multi-tenant-api-example-stack';

test('Multi Tenant Api Example Stack Matches Snapshot', () => {
  const app = new cdk.App();

  const stack = new MultiTenantApiGatewayExampleStack(app, 'MyTestStack');

  const template = Template.fromStack(stack);

  expect(template.toJSON()).toMatchSnapshot();
});
