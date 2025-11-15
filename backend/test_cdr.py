from fastapi import FastAPI, Query
import pymysql
from datetime import datetime

app = FastAPI(title="CDR Test API")

# Vicidial MySQL Database Connection
VICIDIAL_DB_HOST = "74.50.85.175"  # Your Vicidial server IP
VICIDIAL_DB_USER = "cron"           # Your MySQL username  
VICIDIAL_DB_PASS = "1234"  # Your MySQL password
VICIDIAL_DB_NAME = "asterisk"       # Database name

def get_vicidial_db():
    """Connect to Vicidial MySQL database"""
    return pymysql.connect(
        host=VICIDIAL_DB_HOST,
        user=VICIDIAL_DB_USER,
        password=VICIDIAL_DB_PASS,
        database=VICIDIAL_DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

@app.get("/")
def home():
    return {"message": "CDR Test API is running!"}

@app.get("/test-connection")
def test_database_connection():
    """Test if we can connect to Vicidial database"""
    try:
        db = get_vicidial_db()
        cursor = db.cursor()
        cursor.execute("SELECT VERSION()")
        version = cursor.fetchone()
        cursor.close()
        db.close()
        return {
            "success": True,
            "message": "Connected to Vicidial database!",
            "mysql_version": version
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/cdr")
def get_cdr_records(
    start_date: str = Query("2025-11-13"),
    end_date: str = Query("2025-11-14"),
    campaign: str = Query(None),
    status: str = Query(None),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    Get Call Detail Records from Vicidial database
    
    Example: /cdr?start_date=2025-11-13&end_date=2025-11-14&campaign=0006&limit=50
    """
    
    try:
        # Connect to Vicidial database
        vici_db = get_vicidial_db()
        cursor = vici_db.cursor()
        
        # Build SQL query for outbound calls
        query = """
            SELECT 
                call_date,
                lead_id,
                campaign_id,
                phone_number,
                user,
                status,
                length_in_sec,
                term_reason
            FROM vicidial_log
            WHERE call_date BETWEEN %s AND %s
        """
        
        params = [start_date + " 00:00:00", end_date + " 23:59:59"]
        
        # Add filters if provided
        if campaign:
            query += " AND campaign_id = %s"
            params.append(campaign)
            
        if status:
            query += " AND status = %s"
            params.append(status)
        
        query += " ORDER BY call_date DESC LIMIT %s"
        params.append(limit)
        
        # Execute query
        print(f"Executing query: {query}")
        print(f"With params: {params}")
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        
        # Close connection
        cursor.close()
        vici_db.close()
        
        return {
            "success": True,
            "total_records": len(records),
            "query_params": {
                "start_date": start_date,
                "end_date": end_date,
                "campaign": campaign,
                "status": status,
                "limit": limit
            },
            "records": records
        }
        
    except Exception as e:
        print(f"❌ Error fetching CDR: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/cdr/connected-only")
def get_connected_calls(
    start_date: str = Query("2025-11-13"),
    end_date: str = Query("2025-11-14"),
    campaign: str = Query("0006"),
    limit: int = Query(100)
):
    """
    Get only connected/answered calls with phone numbers
    
    Example: /cdr/connected-only?start_date=2025-11-13&end_date=2025-11-14
    """
    
    try:
        vici_db = get_vicidial_db()
        cursor = vici_db.cursor()
        
        # Connected statuses (adjust based on your setup)
        connected_statuses = ['SALE', 'A', 'AA', 'AB', 'ADAIR', 'B', 'CNAV', 'DC', 'DNC', 'DROP', 'HU', 'INCALL', 'WNB']
        
        placeholders = ','.join(['%s'] * len(connected_statuses))
        
        query = f"""
            SELECT 
                call_date,
                lead_id,
                campaign_id,
                phone_number,
                user as agent,
                status,
                length_in_sec as duration_seconds,
                term_reason
            FROM vicidial_log
            WHERE call_date BETWEEN %s AND %s
            AND campaign_id = %s
            AND status IN ({placeholders})
            ORDER BY call_date DESC
            LIMIT %s
        """
        
        params = [start_date + " 00:00:00", end_date + " 23:59:59", campaign] + connected_statuses + [limit]
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        
        cursor.close()
        vici_db.close()
        
        return {
            "success": True,
            "total_connected_calls": len(records),
            "date_range": f"{start_date} to {end_date}",
            "campaign": campaign,
            "connected_calls": records
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return {"success": False, "error": str(e)}