import requests
from .const import HEADERS
from .company_facts_db import save_company_facts

"""
개별 기업의 재무 정보를 sec edgar api로 가져옴
"""

def get_company_facts(ticker):
    # SEC의 티커-CIK 매핑 데이터 가져오기
    ticker_url = "https://www.sec.gov/files/company_tickers.json"

    response = requests.get(ticker_url, headers=HEADERS)
    ticker_data = response.json()

    # 티커에 해당하는 CIK 찾기
    cik = None
    for item in ticker_data.values():
        if item['ticker'] == ticker.upper():
            # CIK는 10자리 숫자로 맞추어야 함 (앞에 0을 채움)
            cik = str(item['cik_str']).zfill(10)
            break

    if not cik:
        print(f"Ticker {ticker} 를 찾을 수 없습니다.")
        return None

    # Company Facts API 호출
    facts_url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    facts_response = requests.get(facts_url, headers=HEADERS)

    if facts_response.status_code != 200:
        print("데이터를 가져오는 데 실패했습니다.")
        return None

    facts_data = facts_response.json()
    return facts_data

if __name__ == "__main__":
    import os
    ticker_to_search = "AAPL"
    facts = get_company_facts(ticker_to_search)
    if facts:
        save_company_facts(facts, os.path.join(os.path.dirname(__file__), "db", "company_facts.db"), ticker=ticker_to_search)

