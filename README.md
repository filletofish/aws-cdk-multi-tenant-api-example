# AWS CDK Multi Tenant API Example

This project is an example implementation of multi-tenant API build with AWS CDK and Typescript created for
blog post [Building multi-tenant internal services in AWS and CDK: Part 1 — API Gateway and App Sync](https://filippfediakov.medium.com/building-multi-tenant-internal-services-in-aws-and-cdk-part-1-api-gateway-and-app-sync-475d97faa1e7).

## Deployment

Prerequisites: 

1. Typescript
2. AWS CLI
3. AWS CDK CLI

If not configured add your AWS Account to environment variable `CDK_DEFAULT_ACCOUNT` and region to `CDK_DEFAULT_REGION`. 

Build and deploy app with: 

```
npm run build && npm run deploy
```

## Test API and Update API clients

Run script that signs requests with your local AWS credentials and sends test API request.

```
npx ts-node scripts/invoke-api.ts
```

Right now the app deploys API Gateway with two clients that also use your AWS accounts.
You can update list of API clients and use different AWS accounts in [multi-tenant-api-example-stack.ts](https://github.com/filletofish/aws-cdk-multi-tenant-api-example/blob/main/lib/multi-tenant-api-example-stack.ts#L17-L32).

## Useful commands

The `cdk.json` file tells the CDK Toolkit how to execute your app.

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npm run deploy`  to deploy this stack to your default AWS account/region with hotswap option
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

