import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
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

  const allItems: Record<string, unknown>[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    if (lastEvaluatedKey) {
      fullParams.ExclusiveStartKey = lastEvaluatedKey;
    }
    const result = await docClient.send(new QueryCommand(fullParams));
    if (result.Items) {
      allItems.push(...(result.Items as Record<string, unknown>[]));
    }
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return allItems;
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

export async function batchGetItems(
  keys: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  if (keys.length === 0) return [];

  const allItems: Record<string, unknown>[] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    const result = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLE_NAME]: { Keys: batch },
        },
      })
    );
    const items = result.Responses?.[TABLE_NAME] ?? [];
    allItems.push(...(items as Record<string, unknown>[]));

    // Handle unprocessed keys by re-queuing (throttling)
    let unprocessed = result.UnprocessedKeys?.[TABLE_NAME]?.Keys ?? [];
    while (unprocessed.length > 0) {
      const retry = await docClient.send(
        new BatchGetCommand({ RequestItems: { [TABLE_NAME]: { Keys: unprocessed } } })
      );
      allItems.push(...((retry.Responses?.[TABLE_NAME] ?? []) as Record<string, unknown>[]));
      unprocessed = retry.UnprocessedKeys?.[TABLE_NAME]?.Keys ?? [];
    }
  }

  return allItems;
}

export async function batchWriteItems(
  items: Record<string, unknown>[]
): Promise<void> {
  if (items.length === 0) return;

  const BATCH_SIZE = 25; // DynamoDB limit

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    let requestItems = batch.map((item) => ({ PutRequest: { Item: item } }));

    while (requestItems.length > 0) {
      const result = await docClient.send(
        new BatchWriteCommand({
          RequestItems: { [TABLE_NAME]: requestItems },
        })
      );
      const unprocessed = result.UnprocessedItems?.[TABLE_NAME] ?? [];
      requestItems = unprocessed as typeof requestItems;
      if (requestItems.length > 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
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
