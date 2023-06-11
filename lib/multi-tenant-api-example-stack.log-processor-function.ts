import { Context, CloudWatchLogsEvent, Callback, CloudWatchLogsDecodedData } from 'aws-lambda';
import * as zlib from 'zlib';

import { MetricResolution, Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';

const metrics = new Metrics({
  namespace: 'MultiTenantApi',
  serviceName: 'multi-tenant-api',
});

interface ApiAccessLogEvent {
  requestId: string;
  path: string;
  httpMethod: string;
  userArn: string;
  status: string;
  responseLatency: string;
}

export const handler = (event: CloudWatchLogsEvent, context: Context, callback: Callback) => {
  console.log('Event: ' + JSON.stringify(event, null, 2));
  const decoded = Buffer.from(event.awslogs.data, 'base64');
  zlib.gunzip(decoded, (e, result) => {
    if (e) {
      callback(e, null);
    } else {
      const json: CloudWatchLogsDecodedData = JSON.parse(result.toString('ascii'));
      json.logEvents.forEach((event) => {
        const apiAccessLogEvent: ApiAccessLogEvent = JSON.parse(event.message);

        console.log(`Parsed api access log event:` + JSON.stringify(apiAccessLogEvent));
        publishCustomMetricForAccessLogEvent(apiAccessLogEvent);
      });
      callback(null);
    }
  });
};

function createSingleMetricWithDefaultDimensions(accessLogEvent: ApiAccessLogEvent): Metrics {
  const singleMetric = metrics.singleMetric();

  singleMetric.addDimension('Path', accessLogEvent.path);
  const clientName = extractClientNameFromARN(accessLogEvent.userArn);
  singleMetric.addDimension('ClientName', clientName);
  singleMetric.addDimension('Method', accessLogEvent.httpMethod);

  return singleMetric;
}

// TODO: Specify timestamp of published metrics. Looks like EMF that used under the hood in EMF doesn't support setting metric timestamp
// https://github.com/awslabs/aws-lambda-powertools-python/issues/166
function publishCustomMetricForAccessLogEvent(accessLogEvent: ApiAccessLogEvent) {
  const countMetric = createSingleMetricWithDefaultDimensions(accessLogEvent);
  countMetric.addMetric('Count', MetricUnits.Count, 1, MetricResolution.High);

  const latency = parseInt(accessLogEvent.responseLatency);
  const latencyMetric = createSingleMetricWithDefaultDimensions(accessLogEvent);
  latencyMetric.addMetric('Latency', MetricUnits.Milliseconds, latency, MetricResolution.High);

  const statusCode = parseInt(accessLogEvent.status);
  if (statusCode >= 400 && statusCode < 500) {
    const clientErrorMetric = createSingleMetricWithDefaultDimensions(accessLogEvent);
    clientErrorMetric.addMetric('4XXError', MetricUnits.Count, 1, MetricResolution.High);
  }

  if (statusCode >= 500) {
    const serviceErrorMetric = createSingleMetricWithDefaultDimensions(accessLogEvent);
    serviceErrorMetric.addMetric('5XXError', MetricUnits.Count, 1, MetricResolution.High);
  }
}

const CLIENT_ROLE_ARN_REGEX = /^arn:aws:sts::\d+:assumed-role\/MultiTenantApiClient-(.+)-role\/\w+$/;

function isValidARN(value: string): boolean {
  const regex = CLIENT_ROLE_ARN_REGEX;
  return regex.test(value);
}

function extractClientNameFromARN(value: string): string {
  if (!isValidARN) {
    return 'unknown';
  }
  const match = value.match(CLIENT_ROLE_ARN_REGEX);
  if (match && match.length === 2) {
    return match[1];
  }

  return 'unknown';
}
