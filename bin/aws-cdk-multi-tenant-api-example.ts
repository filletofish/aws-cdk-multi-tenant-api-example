#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MultiTenantApiGatewayExampleStack } from '../lib/aws-cdk-multi-tenant-api-example-stack';

const app = new cdk.App();
new MultiTenantApiGatewayExampleStack(app, 'AwsCdkMultiTenantApiExampleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
