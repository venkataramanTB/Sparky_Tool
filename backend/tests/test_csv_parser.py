from csv_parser import parse_and_compute

CSV_BYTES = b"name,age,salary\nAlice,30,50000\nBob,25,45000\nCharlie,35,60000"

def test_row_count_and_columns():
    result = parse_and_compute(CSV_BYTES)
    assert result["row_count"] == 3
    assert result["columns"] == ["name", "age", "salary"]
    assert len(result["rows"]) == 3

def test_numeric_kpis():
    result = parse_and_compute(CSV_BYTES)
    age = result["kpis"]["age"]
    assert age["type"] == "numeric"
    assert age["count"] == 3
    assert age["sum"] == 90.0
    assert age["mean"] == 30.0
    assert age["min"] == 25.0
    assert age["max"] == 35.0

def test_categorical_kpis():
    result = parse_and_compute(CSV_BYTES)
    name = result["kpis"]["name"]
    assert name["type"] == "categorical"
    assert name["count"] == 3
    assert name["unique_count"] == 3
    assert "Alice" in name["value_counts"]

def test_rows_contain_all_fields():
    result = parse_and_compute(CSV_BYTES)
    first = result["rows"][0]
    assert "name" in first
    assert "age" in first
    assert "salary" in first
