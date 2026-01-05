import redis

r = redis.from_url('redis://127.0.0.1:6379')

# Add test data
r.set('user:1', '{"id":"1","name":"Alice"}')
r.set('user:2', '{"id":"2","name":"Bob"}')
r.set('product:1', '{"id":"1","title":"Widget"}')
r.set('product:2', '{"id":"2","title":"Gadget"}')

# Check what was added
keys = r.keys()
print(f'Keys: {keys}')
print(f'DBSIZE: {r.dbsize()}')

# Get one value
print(f'user:1 = {r.get("user:1")}')
