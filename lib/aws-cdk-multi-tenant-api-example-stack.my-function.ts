import { Context, APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  console.log(`Context: ${JSON.stringify(context, null, 2)}`);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const callerArn = event.requestContext.identity.userArn!;
  console.log(`Caller AWS ARN: ${callerArn}`);

  // Randomly throwing an error to demo how errors are handled in metrics / access logs
  const randomNumber = Math.random();
  if (randomNumber < 0.5) {
    throw new Error('Random internal error occurred!');
  }

  const callerAwsAccount = extractAWSAccountFromARN(callerArn);
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Received API Call from AWS account=${callerAwsAccount}`,
    }),
  };
};

export const extractAWSAccountFromARN = (arn: string): string | null => {
  const regex = /^arn:aws:[a-z-]+::(\d+):.*$/;
  const match = arn.match(regex);
  if (match && match.length === 2) {
    return match[1];
  }
  return null;
};
