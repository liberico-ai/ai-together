import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('portal', ROOT / 'dashboard/plugin_api.py')
portal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(portal)

class PortalTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.backend_status = 200
        self.backend_headers = {}
        self.home = portal.EXPECTED_HOME
        def auth(request):
            if request.headers.get('x-test-auth') != 'accepted':
                raise HTTPException(401)
        self.modules = patch.dict(sys.modules, {
            'hermes_constants': types.SimpleNamespace(get_hermes_home=lambda: self.home),
            'hermes_cli.web_server': types.SimpleNamespace(_require_token=auth),
        })
        self.modules.start()
        def upstream(request):
            self.calls.append(request)
            return httpx.Response(self.backend_status, json={'data': {'test': True}, 'error': None}, headers=self.backend_headers)
        real_client = httpx.AsyncClient
        self.client_patch = patch.object(portal.httpx, 'AsyncClient', lambda **kw: real_client(transport=httpx.MockTransport(upstream), **kw))
        self.client_patch.start()
        app = FastAPI(); app.include_router(portal.router, prefix='/api/plugins/libetech-ai-os-web')
        self.client = TestClient(app, base_url=portal.ORIGIN)
        self.headers = {'x-test-auth': 'accepted', 'origin': portal.ORIGIN}
    def tearDown(self):
        self.client_patch.stop(); self.modules.stop(); self.client.close()
    def get(self, action, **kw):
        return self.client.get('/api/plugins/libetech-ai-os-web/'+action, headers=self.headers, **kw)
    def post(self, action, **kw):
        return self.client.post('/api/plugins/libetech-ai-os-web/'+action, headers=self.headers, **kw)
    def test_hermes_auth_required(self):
        self.headers = {}; self.assertEqual(self.get('health').status_code, 401); self.assertFalse(self.calls)
    def test_secondary_profile_denied_before_network(self):
        self.home = portal.EXPECTED_HOME/'profiles/xeca'; self.assertEqual(self.get('me').status_code,403); self.assertFalse(self.calls)
    def test_arbitrary_route_bridge_activation_and_writes_denied(self):
        for route in ['bridge','activate','work','config','http://other']:
            self.assertEqual(self.post(route,json={}).status_code,404)
        self.assertFalse(self.calls)
    def test_query_not_forwarded_or_repurposed(self):
        for query in ['?url=http://other','?profile=xeca','?profile=default&profile=xeca']:
            self.assertEqual(self.get('health'+query).status_code,403)
        self.assertFalse(self.calls)
    def test_csrf_before_credentials(self):
        for origin in ['', 'https://evil.example', 'null']:
            self.headers['origin']=origin; self.assertEqual(self.post('login',json={}).status_code,403)
        self.assertFalse(self.calls)
    def test_host_and_cross_site_denied(self):
        self.headers['host']='other.example'; self.assertEqual(self.get('me').status_code,403)
        self.headers['host']=portal.HOST; self.headers['sec-fetch-site']='cross-site'
        self.assertEqual(self.get('me').status_code,403); self.assertFalse(self.calls)
    def test_form_post_and_oversize_rejected(self):
        self.assertEqual(self.post('login',data={'username':'x'}).status_code,415)
        self.assertEqual(self.post('login',json={'password':'x'*9000}).status_code,413); self.assertFalse(self.calls)
    def test_fixed_backend_and_credential_minimization(self):
        self.headers['cookie']='hermes=private; libetech_session='+'a'*43
        self.headers['authorization']='Bearer do-not-forward'
        self.assertEqual(self.post('login?profile=default',json={'username':'fixture','password':'fixture-only'}).status_code,200)
        request=self.calls[0]
        self.assertEqual(str(request.url),'http://127.0.0.1:3148/api/auth/login')
        self.assertEqual(request.headers['cookie'],'libetech_session='+'a'*43)
        self.assertNotIn('authorization',request.headers)
        self.assertEqual(request.headers['origin'],portal.ORIGIN)
        self.assertEqual(request.headers['host'],portal.HOST)
    def test_invalid_or_duplicate_cookie_not_forwarded(self):
        for raw in ['libetech_session=bad', 'libetech_session='+'a'*43+'; libetech_session='+'b'*43]:
            self.headers['cookie']=raw; self.get('me'); self.assertNotIn('cookie',self.calls[-1].headers)
    def test_login_cookie_secure_scoped_and_not_body_token(self):
        self.backend_headers={'set-cookie':'libetech_session='+'a'*43+'; Path=/; HttpOnly'}
        response=self.post('login',json={}); cookie=response.headers['set-cookie']
        for part in ['Secure','HttpOnly','SameSite=Strict','Path='+portal.COOKIE_PATH]: self.assertIn(part,cookie)
        self.assertNotIn('a'*43,response.text); self.assertEqual(response.headers['cache-control'],'no-store')
    def test_logout_deletes_same_scoped_cookie(self):
        self.backend_headers={'set-cookie':'libetech_session=; Max-Age=0; Path=/'}
        cookie=self.post('logout',json={}).headers['set-cookie']; self.assertIn('Max-Age=0',cookie); self.assertIn(portal.COOKIE_PATH,cookie)
    def test_backend_denials_preserved(self):
        self.backend_status=401; self.assertEqual(self.get('me').status_code,401)
    def test_redirects_never_followed(self):
        self.backend_status=302; self.backend_headers={'location':'https://other.example'}
        self.assertEqual(self.get('me').status_code,502); self.assertEqual(len(self.calls),1)
    def test_wrong_method_denied(self):
        self.assertEqual(self.get('login').status_code,404); self.assertEqual(self.post('workspace',json={}).status_code,404); self.assertFalse(self.calls)

if __name__ == '__main__': unittest.main()
