import urllib.request
import json
import urllib.error

data = json.dumps({'email':'owner@trstudio.techbill.app','password':'wrong_password','clientSource':'mobile'}).encode('utf-8')
req = urllib.request.Request('https://electrotrack-saas.onrender.com/auth/login', data=data, headers={'Content-Type': 'application/json'})

try:
    res = urllib.request.urlopen(req)
    print(f"Status: {res.getcode()}")
    print(res.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"Error Status: {e.code}")
    print(e.read().decode('utf-8'))
