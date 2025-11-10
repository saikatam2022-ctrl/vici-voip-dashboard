import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from urllib.parse import quote_plus

load_dotenv()

print("=" * 60)
print("PostgreSQL Connection Test")
print("=" * 60)

# Try to get DATABASE_URL first
url = os.getenv("DATABASE_URL")

# If not found, build from individual components
if not url:
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT")
    db_name = os.getenv("DB_NAME")
    
    if all([user, password, host, port, db_name]):
        # Automatically encode the password
        password_encoded = quote_plus(password)
        url = f"postgresql+psycopg2://{user}:{password_encoded}@{host}:{port}/{db_name}"
        print(f"\n✓ Built connection string from .env components")
        print(f"  User: {user}")
        print(f"  Database: {db_name}")
        print(f"  Host: {host}:{port}")
    else:
        print("\n❌ Database configuration incomplete in .env file!")
        print("Missing components:")
        if not user: print("  - DB_USER")
        if not password: print("  - DB_PASSWORD")
        if not host: print("  - DB_HOST")
        if not port: print("  - DB_PORT")
        if not db_name: print("  - DB_NAME")
        exit(1)
else:
    print(f"\n✓ Using DATABASE_URL from .env")

try:
    print("\n🔄 Attempting to connect to PostgreSQL...")
    engine = create_engine(url)
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version();"))
        version = result.fetchone()
        
        result = conn.execute(text("SELECT current_database();"))
        current_db = result.fetchone()[0]
        
        print("\n" + "=" * 60)
        print("✅ CONNECTION SUCCESSFUL!")
        print("=" * 60)
        print(f"📍 Connected to database: {current_db}")
        print(f"🗄️  PostgreSQL version: {version[0][:50]}...")
        print("=" * 60)
        
        # List tables
        result = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """))
        tables = result.fetchall()
        
        if tables:
            print(f"\n📋 Tables found in '{current_db}': {len(tables)}")
            for table in tables:
                print(f"  - {table[0]}")
        else:
            print(f"\n📋 No tables found in '{current_db}' (database is empty)")
        
        print("\n✅ Database connection test completed successfully!")
        print("=" * 60)
            
except Exception as e:
    print("\n" + "=" * 60)
    print("❌ CONNECTION FAILED!")
    print("=" * 60)
    print(f"Error: {e}")
    print("\nTroubleshooting:")
    print("  - Verify PostgreSQL service is running")
    print("  - Check username and password")
    print("  - Ensure database exists")
    print("=" * 60)