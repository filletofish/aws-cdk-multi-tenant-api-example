#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MultiTenantApiExampleStack } from '../lib/multi-tenant-api-example-stack';

const app = new cdk.App();
new MultiTenantApiExampleStack(app, 'MultiTenantApiExampleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
