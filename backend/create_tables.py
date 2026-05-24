from database import create_tables

if __name__ == '__main__':
    try:
        create_tables()
        print('Database tables created successfully.')
    except Exception as exc:
        print('Failed to create database tables:')
        print(exc)
        raise
