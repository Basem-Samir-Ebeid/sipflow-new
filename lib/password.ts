import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'

const BCRYPT_ROUNDS = 10
const BCRYPT_PREFIX = '$2'
const SHA256_HEX_LEN = 64

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith(BCRYPT_PREFIX)) {
    return bcrypt.compare(plain, stored)
  }
  if (stored.length === SHA256_HEX_LEN && /^[0-9a-f]+$/.test(stored)) {
    return createHash('sha256').update(plain).digest('hex') === stored
  }
  return plain === stored
}
