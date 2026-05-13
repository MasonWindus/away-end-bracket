import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ses from 'aws-cdk-lib/aws-ses';
import { Construct } from 'constructs';
import * as path from 'path';

export class AwayEndBracketStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── DynamoDB ─────────────────────────────────────────────────────────────
    const table = new dynamodb.Table(this, 'AwayEndTable', {
      tableName: 'AwayEndBracket',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // GSI for leaderboard queries (all users sorted by score)
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── SSM Parameters (create these manually before deploy) ─────────────────
    // aws ssm put-parameter --name /away-end/jwt-secret --value "your-secret" --type String
    // aws ssm put-parameter --name /away-end/from-email --value "noreply@yourdomain.com" --type String
    // aws ssm put-parameter --name /away-end/frontend-url --value "https://yourdomain.com" --type String
    const jwtSecret = ssm.StringParameter.fromStringParameterName(
      this,
      'JwtSecret',
      '/away-end/jwt-secret'
    );
    const fromEmail = ssm.StringParameter.fromStringParameterName(
      this,
      'FromEmail',
      '/away-end/from-email'
    );
    const frontendUrl = ssm.StringParameter.fromStringParameterName(
      this,
      'FrontendUrl',
      '/away-end/frontend-url'
    );

    // ─── Lambda ───────────────────────────────────────────────────────────────
    const apiLambda = new lambda.Function(this, 'ApiFunction', {
      functionName: 'away-end-bracket-api',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        DYNAMODB_TABLE: table.tableName,
        JWT_SECRET: jwtSecret.stringValue,
        FROM_EMAIL: fromEmail.stringValue,
        FRONTEND_URL: frontendUrl.stringValue,
        NODE_ENV: 'production',
      },
    });

    // Grant Lambda access to DynamoDB
    table.grantReadWriteData(apiLambda);

    // Grant Lambda access to SES for sending magic link emails
    apiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    // Grant Lambda access to SSM parameters
    jwtSecret.grantRead(apiLambda);
    fromEmail.grantRead(apiLambda);
    frontendUrl.grantRead(apiLambda);

    // ─── API Gateway ──────────────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'AwayEndApi', {
      restApiName: 'away-end-bracket-api',
      description: 'The Away End bracket contest API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
        allowCredentials: true,
      },
      deployOptions: {
        stageName: 'prod',
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(apiLambda, {
      proxy: true,
    });

    // Proxy all /api/* paths to Lambda
    const apiResource = api.root.addResource('api');
    apiResource.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // ─── S3 Frontend Bucket ───────────────────────────────────────────────────
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `away-end-bracket-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ─── CloudFront ───────────────────────────────────────────────────────────
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'OAI',
      { comment: 'Away End Bracket OAI' }
    );
    frontendBucket.grantRead(originAccessIdentity);

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, { originAccessIdentity }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        // API requests go to API Gateway (no caching)
        '/api/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      // SPA routing: fallback to index.html for client-side routes
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      defaultRootObject: 'index.html',
    });

    // ─── Deploy Frontend ──────────────────────────────────────────────────────
    new s3deploy.BucketDeployment(this, 'FrontendDeployment', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend/dist'))],
      destinationBucket: frontendBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // ─── Outputs ──────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'The Away End bracket site URL',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'DynamoDBTable', {
      value: table.tableName,
      description: 'DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 bucket for frontend assets',
    });
  }
}
