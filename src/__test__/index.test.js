import knex from 'knex';
import faker from 'faker';
import matchers from '../';

const query = jest.fn(() => Promise.resolve([]));

const client = class extends knex.Client {
  _query = query;
  acquireConnection = () => Promise.resolve({});
  processResponse = resp => resp;
  releaseConnection = () => Promise.resolve();
};

const db = knex({ client });

jest.addMatchers(matchers);

it('select', async () => {
  const table = faker.lorem.word();

  query.mockClear();
  await db(table).select('*');
  expect(query).toHaveBeenLastQueriedWith({ method: 'select', table });
});

it('insert', async () => {
  const table = faker.lorem.word();
  const name = faker.lorem.word();
  const value = faker.random.number();

  query.mockClear();
  await db(table).insert({ name, value });
  expect(query).toHaveBeenLastQueriedWith({ method: 'insert', table, name, value });
});

it('update', async () => {
  const table = faker.lorem.word();
  const id = faker.random.number();
  const name = faker.lorem.word();
  const value = faker.random.number();

  query.mockClear();
  await db(table).where({ id }).update({ name, value });
  expect(query).toHaveBeenLastQueriedWith({ method: 'update', id, table, name, value });
});

it('delete', async () => {
  const table = faker.lorem.word();
  const id = faker.random.number();

  query.mockClear();
  await db(table).where({ id }).delete();
  expect(query).toHaveBeenLastQueriedWith({ method: 'delete', id, table });
});

it('toHaveBeenQueriedWith', async () => {
  const table = faker.lorem.word();
  const id = faker.random.number();
  const name = faker.lorem.word();
  const value = faker.random.number();

  query.mockClear();
  await db(table).select('*');
  await db(table).insert({ name, value });
  await db(table).where({ id }).update({ name, value });
  await db(table).where({ id }).delete();

  expect(query).toHaveBeenQueriedWith([
    { method: 'select', table },
    { method: 'insert', table, name, value },
    { method: 'update', id, table, name, value },
    { method: 'delete', id, table },
  ]);
});
