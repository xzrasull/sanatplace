import { assertTestDatabase } from './helpers/assert-test-database';

export default function globalSetup() {
  assertTestDatabase();
}
