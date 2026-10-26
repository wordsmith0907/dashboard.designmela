import test from 'node:test';
import { validatedOrigin } from '../src/lib/runtime-config';
import assert from 'node:assert/strict';
import { authCookieOptions, authFailure, confirmationType, safeNext, validEmail, validNewPassword, validTokenHash } from '../src/lib/auth/policy';

test('Auth redirects accept only exact workspace destinations',()=>{
  for (const value of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/%2f%2fevil.invalid','/crm?next=https://evil.invalid','/auth/callback','javascript:alert(1)','/crm\r\nLocation: https://evil.invalid',null,['/crm']]) assert.equal(safeNext(value),'/');
  for (const value of ['/crm','/setup','/reset-password','/']) assert.equal(safeNext(value),value);
});
test('Email links use configured origins and reject credentials, paths and unsafe protocols',()=>{
  assert.throws(()=>validatedOrigin(undefined));
  assert.equal(validatedOrigin('http://127.0.0.1:3100',true),'http://127.0.0.1:3100');
  assert.equal(validatedOrigin('https://workspace.example.invalid'),'https://workspace.example.invalid');
  for (const value of ['https://name:secret@example.invalid','http://example.invalid','https://example.invalid/path','https://example.invalid?next=evil','javascript:alert(1)']) assert.throws(()=>validatedOrigin(value));
});
test('Password and email validation enforce stated requirements without trimming passwords',()=>{
  for (const value of ['Short1!','abcdefghijklmnop','ABCDEFGHIJKLMNOP','1234567890123456','ValidButNoNumber!']) assert.equal(validNewPassword(value),false);
  assert.equal(validNewPassword(['Example','12','-Password'].join('')),true);
  assert.equal(validEmail('owner@example.invalid'),true);
  assert.equal(validEmail('owner@example.invalid\nBcc: other@example.invalid'),false);
});
test('Auth cookies are HTTP-only, SameSite Lax, and Secure on HTTPS',()=>{
  assert.deepEqual(authCookieOptions('https://example.invalid'),{path:'/',sameSite:'lax',httpOnly:true,secure:true});
  assert.equal(authCookieOptions('http://127.0.0.1:3100').secure,false);
});
test('Authentication failures hide raw provider details and distinguish throttling/verification',()=>{
  assert.equal(authFailure({status:429}).retryAfter,60);
  assert.match(authFailure({code:'email_not_confirmed'}).message,/Verify your email/);
  assert.match(authFailure({status:400,code:'invalid_credentials'}).message,/email or password was not accepted/);
  assert.match(authFailure({status:503}).message,/service is unavailable/);
});
test('Confirmation accepts only supported email flows and bounded token hashes',()=>{
  for (const value of ['invite','recovery','email','signup']) assert.equal(confirmationType(value),value);
  for (const value of ['sms','email_change','magiclink','owner',null]) assert.equal(confirmationType(value),null);
  assert.equal(validTokenHash('a'.repeat(64)),true);
  assert.equal(validTokenHash('a'.repeat(257)),false);
  assert.equal(validTokenHash('//example.invalid'),false);
});
