import redis

r = redis.from_url('redis://127.0.0.1:6379')

print("Testing KEYS command:")
keys = r.keys('*')
print(f"  All keys: {keys}")
print(f"  Count: {len(keys)}")

print("\nTesting DBSIZE:")
print(f"  DBSIZE: {r.dbsize()}")

print("\nTrying to GET each key:")
for key in ['user:1', 'user:2', 'product:1', 'product:2']:
    val = r.get(key)
    print(f"  {key} = {val}")
