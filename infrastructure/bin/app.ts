#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwayEndBracketStack } from '../lib/stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

new AwayEndBracketStack(app, 'AwayEndBracketStack', {
  env,
  description: 'The Away End — World Cup 2026 Bracket Contest',
});
