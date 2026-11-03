"""Owner-run, TEST-only existing-user password updates. No credential persistence."""
import argparse
import base64
import getpass
import hashlib
import http.client
import json
import re
import resource
import ssl
import sys
import time
import uuid
import warnings
from admin_lab_settings import read_config, validate, production_host

PROJECT_NAME = 'pulse-echo-security-lab'
# Public project identity fingerprint, pinned from the reviewed TEST configuration.
TEST_REF_SHA256 = '808bf65cd5d0a599e7a0470d1670c128bd5e2a6445ef5111d5c9994de1f5ac35'
ROLES = ('administrator', 'non_administrator')

class Stopped(Exception):
    """Only fixed safe codes; never propagate provider text or credential values."""
    pass

def checked_config(config):
    try:
        cfg = validate(config)
        if hashlib.sha256(cfg['testProjectRef'].encode()).hexdigest() != TEST_REF_SHA256:
            raise ValueError()
        return cfg
    except Exception:
        raise Stopped('TEST_CONFIG_REJECTED') from None

def checked_uuid(value):
    try:
        parsed = str(uuid.UUID(value))
        if parsed != value or parsed == str(uuid.UUID(int=0)):
            raise ValueError()
        return parsed
    except Exception:
        raise Stopped('UUID_REJECTED') from None

def checked_key(key, cfg):
    # Opaque sb_secret keys cannot be bound to a project offline, so reject them.
    try:
        if len(key) > 8192 or not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', key):
            raise ValueError()
        head, body, signature = key.split('.')
        decode = lambda part: json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))
        header, claims = decode(head), decode(body)
        if (header.get('alg') != 'HS256' or claims.get('iss') != 'supabase'
                or claims.get('role') != 'service_role'
                or claims.get('ref') != cfg['testProjectRef']
                or claims.get('ref') + '.supabase.co' == production_host()
                or type(claims.get('exp')) is not int or claims['exp'] <= time.time()
                or len(signature) < 40):
            raise ValueError()
    except Exception:
        raise Stopped('ADMIN_KEY_REJECTED') from None
    # Claims are a local routing guard, not signature verification. Auth validates
    # the actual signature/permission at the pinned TEST endpoint before any PUT.
    return key

def checked_password(password, confirmation):
    if (password != confirmation or not 12 <= len(password) <= 256
            or len(password.encode('utf-8')) > 72 or password.isspace()
            or any(ord(c) < 32 or ord(c) == 127 for c in password)):
        raise Stopped('PASSWORD_INPUT_REJECTED')
    return password

class AuthOnlyTransport:
    def __init__(self, config, key):
        self.cfg = checked_config(config)
        self.key = checked_key(key, self.cfg)
        self.allowed_ids = set()

    def allow_users(self, ids):
        if len(ids) != 2 or len(set(ids)) != 2:
            raise Stopped('TARGETS_REJECTED')
        self.allowed_ids = {checked_uuid(v) for v in ids}

    def request(self, method, user_id, payload=None):
        # Revalidate before every connection. No arbitrary URL, redirect, proxy,
        # query, account creation/deletion, token login, DB or management endpoint.
        self.cfg = checked_config(self.cfg)
        checked_key(self.key, self.cfg)
        if user_id not in self.allowed_ids or method not in ('GET', 'PUT'):
            raise Stopped('REQUEST_REJECTED')
        checked_uuid(user_id)
        if method == 'PUT':
            if not isinstance(payload, dict) or set(payload) != {'password'}:
                raise Stopped('PAYLOAD_REJECTED')
            checked_password(payload['password'], payload['password'])
        elif payload is not None:
            raise Stopped('PAYLOAD_REJECTED')
        conn = None
        try:
            conn = http.client.HTTPSConnection(self.cfg['testProjectRef'] + '.supabase.co',
                                               timeout=15, context=ssl.create_default_context())
            headers = {'apikey': self.key, 'Authorization': 'Bearer ' + self.key,
                       'Content-Type': 'application/json', 'Accept': 'application/json'}
            body = None if payload is None else json.dumps(payload).encode('utf-8')
            conn.request(method, '/auth/v1/admin/users/' + user_id, body=body, headers=headers)
            response = conn.getresponse()
            # Do not read or display provider error bodies. Never follow redirects.
            if response.status != 200:
                code = response.status if response.status in (301,302,303,307,308,400,401,403,404,422,429,500,502,503,504) else 'OTHER'
                raise Stopped('AUTH_HTTP_' + str(code))
            raw = response.read(131073)
            if len(raw) > 131072:
                raise Stopped('AUTH_RESPONSE_REJECTED')
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise Stopped('AUTH_RESPONSE_REJECTED')
            return result
        except Stopped:
            raise
        except Exception:
            raise Stopped('AUTH_NETWORK_OR_RESPONSE_FAILURE') from None
        finally:
            if conn:
                conn.close()


def checked_user(data, target):
    try:
        user = data.get('user', data)
        if (user['id'] != target['id'] or user['email'].casefold() != target['email'].casefold()
                or not user.get('email_confirmed_at')):
            raise ValueError()
        return user
    except Exception:
        raise Stopped('USER_IDENTITY_REJECTED') from None


def run(config, secret, ask, emit, execute=False, transport_factory=AuthOnlyTransport):
    cfg = checked_config(config)
    progress = {role:'not_attempted' for role in ROLES}
    key = None
    targets = []
    try:
        if ask('Type TEST project name: ') != PROJECT_NAME or ask('Type TEST project ref: ') != cfg['testProjectRef']:
            raise Stopped('PROJECT_CONFIRMATION_REJECTED')
        # This is an owner attestation, NOT an API verification of settings.
        emit('Before execution, inspect TEST Auth security notifications. No setting is changed by this tool.')
        if ask('Password-changed notifications checked OFF? Type CHECKED_OFF: ') != 'CHECKED_OFF':
            raise Stopped('NOTIFICATION_CHECK_REQUIRED')
        key = checked_key(secret('TEST legacy service_role key (hidden; not saved): '), cfg)
        for role in ROLES:
            user_id = checked_uuid(secret(role + ' existing UUID (hidden): '))
            if (role == 'administrator' and user_id != cfg['adminUserId']) or any(t['id'] == user_id for t in targets):
                raise Stopped('TARGETS_REJECTED')
            email = secret(role + ' existing email (hidden): ').strip()
            if not email or '@' not in email or any(ord(c) < 32 for c in email):
                raise Stopped('EMAIL_INPUT_REJECTED')
            password = checked_password(secret(role + ' new password (hidden): '), secret(role + ' repeat new password (hidden): '))
            targets.append({'role':role,'id':user_id,'email':email,'password':password})
        if targets[0]['email'].casefold() == targets[1]['email'].casefold():
            raise Stopped('TARGETS_REJECTED')
        if not execute:
            emit('PASS local input validation ONLY. No connection, authentication, email or user update attempted.')
            return 0
        if ask('Type VERIFY_EXISTING_USERS to allow two TEST Auth reads: ') != 'VERIFY_EXISTING_USERS':
            raise Stopped('READ_CANCELLED')
        api = transport_factory(cfg, key)
        api.allow_users([t['id'] for t in targets])
        # Validate BOTH existing users before the first write.
        for target in targets:
            checked_user(api.request('GET', target['id']), target)
            emit(target['role'] + ': existing UUID/email verified (values hidden).')
        for target in targets:
            role = target['role']
            if ask('Type UPDATE_' + role.upper() + ' to update only this TEST password: ') != 'UPDATE_' + role.upper():
                raise Stopped('UPDATE_CANCELLED')
            # Recheck identity immediately before mutation.
            checked_user(api.request('GET', target['id']), target)
            progress[role] = 'unknown_do_not_retry'
            updated = api.request('PUT', target['id'], {'password':target['password']})
            checked_user(updated, target)
            progress[role] = 'updated_uuid_matched'
            checked_user(api.request('GET', target['id']), target)
            emit(role + ': password update accepted; UUID unchanged; identity read-back matched.')
            target['password'] = None
        emit('Finished. Run the separate Auth-only login diagnostic with the new passwords. No match requests were made.')
        return 0
    except Stopped as error:
        emit('STOP: ' + str(error))
        emit('Progress: ' + '; '.join(role + '=' + progress[role] for role in ROLES))
        emit('No automatic retry or rollback. An unknown result needs Auth diagnosis before another update.')
        return 1
    except (KeyboardInterrupt, EOFError):
        emit('STOP: CANCELLED. Progress: ' + '; '.join(role + '=' + progress[role] for role in ROLES))
        return 130
    except Exception:
        emit('STOP: UNEXPECTED_FAILURE. Values omitted. Progress: ' + '; '.join(role + '=' + progress[role] for role in ROLES))
        return 1
    finally:
        key = None
        for target in targets:
            target.clear()
        targets.clear()


class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        # argparse normally echoes unknown arguments, which could be secrets.
        self.exit(2, 'STOP: Invalid options. Never pass credentials as arguments. Values omitted.\n')


def main():
    parser = SafeParser(description='Pinned TEST-only password tool. Default: config validation without network.')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check-inputs', action='store_true', help='Hidden interactive input checks only; NO network')
    mode.add_argument('--execute', action='store_true', help='Only after separate approval: existing TEST Auth user reads and password updates')
    args = parser.parse_args()
    try:
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        cfg = checked_config(read_config())
        if not (args.check_inputs or args.execute):
            print('Pinned TEST configuration validated. NO network or user changes. --check-inputs is offline; --execute requires separate approval.')
            return 0
        if not all(stream.isatty() for stream in (sys.stdin, sys.stdout, sys.stderr)):
            raise Stopped('INTERACTIVE_TERMINAL_REQUIRED')
        warnings.simplefilter('error', getpass.GetPassWarning)  # Never fall back to echo.
        print('TEST project only: ' + PROJECT_NAME + '. No secrets are saved. Never paste credentials into chat.')
        return run(cfg, getpass.getpass, input, print, execute=args.execute)
    except (KeyboardInterrupt, EOFError):
        print('STOP: CANCELLED. No values logged.')
        return 130
    except Exception:
        print('STOP: Local configuration/terminal validation failed. No values logged.')
        return 1

if __name__ == '__main__':
    sys.exit(main())
