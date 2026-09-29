import { getElasticsearchClient, EMAIL_INDEX_NAME, EMAIL_INDEX_MAPPINGS } from '../src/services/search';

async function main() {
  const client = getElasticsearchClient();
  const exists = await client.indices.exists({ index: EMAIL_INDEX_NAME });
  if (exists) {
    console.log(`Deleting existing index ${EMAIL_INDEX_NAME}...`);
    await client.indices.delete({ index: EMAIL_INDEX_NAME });
  }

  console.log(`Creating index ${EMAIL_INDEX_NAME} with explicit keyword mappings...`);
  await client.indices.create({
    index: EMAIL_INDEX_NAME,
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
    },
    mappings: EMAIL_INDEX_MAPPINGS,
  });

  console.log(`Index ${EMAIL_INDEX_NAME} successfully recreated with explicit mappings!`);
}

main().catch(console.error).finally(() => process.exit(0));
