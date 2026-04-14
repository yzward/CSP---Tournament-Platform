import { fetchStartGG } from './lib/startgg';

async function run() {
  const query = `
    query {
      __schema {
        mutationType {
          fields {
            name
          }
        }
      }
    }
  `;
  try {
    const data = await fetchStartGG(query);
    console.log(data.__schema.mutationType.fields.map((f: any) => f.name));
  } catch (e) {
    console.error(e);
  }
}
run();
