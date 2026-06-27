/**
 * Week 3 – URL Shortener: AWS CDK Stack
 *
 * Provisions:
 *   - DynamoDB table (PAY_PER_REQUEST, TTL enabled)
 *   - Two Lambda functions (create + redirect), Node 20
 *   - HTTP API Gateway (v2) wiring them together
 *
 * Deploy:
 *   cd infra && npm install && npx cdk deploy
 */

const cdk = require("aws-cdk-lib");
const { Stack } = cdk;
const lambda = require("aws-cdk-lib/aws-lambda");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const apigatewayv2 = require("aws-cdk-lib/aws-apigatewayv2");
const { HttpLambdaIntegration } = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const path = require("path");

class UrlShortenerStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // ── DynamoDB Table ────────────────────────────────────────────────────────
    const table = new dynamodb.Table(this, "UrlTable", {
      tableName: "url-shortener-links",
      partitionKey: { name: "token", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN, // keep data on stack delete
    });

    // ── Shared Lambda environment ─────────────────────────────────────────────
    const sharedEnv = {
      TABLE_NAME: table.tableName,
      NODE_OPTIONS: "--enable-source-maps",
    };

    // ── Create Lambda ─────────────────────────────────────────────────────────
    const createFn = new lambda.Function(this, "CreateFn", {
      functionName: "url-shortener-create",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/create")),
      environment: sharedEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
    });

    // ── Redirect Lambda ───────────────────────────────────────────────────────
    const redirectFn = new lambda.Function(this, "RedirectFn", {
      functionName: "url-shortener-redirect",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/redirect")),
      environment: sharedEnv,
      timeout: cdk.Duration.seconds(5),
      memorySize: 128,
    });

    // Grant DynamoDB permissions
    table.grantReadWriteData(createFn);
    table.grantReadWriteData(redirectFn);

    // ── HTTP API Gateway (v2) ─────────────────────────────────────────────────
    const api = new apigatewayv2.HttpApi(this, "HttpApi", {
      apiName: "url-shortener-api",
      corsPreflight: {
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"],
      },
    });

    // POST /shorten
    api.addRoutes({
      path: "/shorten",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateIntegration", createFn),
    });

    // GET /r/{token}
    api.addRoutes({
      path: "/r/{token}",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("RedirectIntegration", redirectFn),
    });

    // Inject BASE_URL so create Lambda can build the short link
    createFn.addEnvironment("BASE_URL", api.apiEndpoint);

    // ── Outputs ───────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.apiEndpoint,
      description: "HTTP API base URL",
    });

    new cdk.CfnOutput(this, "TableName", {
      value: table.tableName,
    });
  }
}

const app = new cdk.App();
new UrlShortenerStack(app, "UrlShortenerStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});
