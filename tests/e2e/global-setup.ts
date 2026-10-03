import { assertTestDatabase } from '../helpers/assert-test-database';
import { deleteTestUsers } from './helpers/test-users-cleanup';

export default async function globalSetup() {
  assertTestDatabase();
  // Leftovers of an earlier run that was interrupted before its teardown.
  await deleteTestUsers();
}
