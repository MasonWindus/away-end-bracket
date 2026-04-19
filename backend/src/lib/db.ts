import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  GetCommandInput,
  PutCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  UpdateCommandInput,
  ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const TABLE_NAME = process.env.DYNAMODB_TABLE || "away-end-bracket";

export async function getItem(
  key: Record<string, string | number>
): Promise<Record<string, unknown> | undefined> {
  const params: GetCommandInput = {
    TableName: TABLE_NAME,
    Key: key,
  };
  const result = await docClient.send(new GetCommand(params));
  return result.Item as Record<string, unknown> | undefined;
}

export async function putItem(item: Record<string, unknown>): Promise<void> {
  const params: PutCommandInput = {
    TableName: TABLE_NAME,
    Item: item,
  };
  await docClient.send(new PutCommand(params));
}

export async function deleteItem(
  key: Record<string, string | number>
): Promise<void> {
  const params: DeleteCommandInput = {
    TableName: TABLE_NAME,
    Key: key,
  };
  await docClient.send(new DeleteCommand(params));
}

export async function queryItems(
  params: Omit<QueryCommandInput, "TableName">
): Promise<Record<string, unknown>[]> {
  const fullParams: QueryCommandInput = {
    TableName: TABLE_NAME,
    ...params,
  };
  const result = await docClient.send(new QueryCommand(fullParams));
  return (result.Items || []) as Record<string, unknown>[];
}

export async function updateItem(
  params: Omit<UpdateCommandInput, "TableName">
): Promise<Record<string, unknown> | undefined> {
  const fullParams: UpdateCommandInput = {
    TableName: TABLE_NAME,
    ...params,
  };
  const result = await docClient.send(new UpdateCommand(fullParams));
  return result.Attributes as Record<string, unknown> | undefined;
}

export async function scanItems(
  params: Omit<ScanCommandInput, "TableName">
): Promise<Record<string, unknown>[]> {
  const fullParams: ScanCommandInput = {
    TableName: TABLE_NAME,
    ...params,
  };

  const allItems: Record<string, unknown>[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    if (lastEvaluatedKey) {
      fullParams.ExclusiveStartKey = lastEvaluatedKey;
    }
    const result = await docClient.send(new ScanCommand(fullParams));
    if (result.Items) {
      allItems.push(...(result.Items as Record<string, unknown>[]));
    }
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return allItems;
}
