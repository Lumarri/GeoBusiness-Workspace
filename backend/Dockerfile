FROM gcc:14-bookworm AS native_builder
WORKDIR /native
COPY native/spatial.cpp ./
RUN g++ -std=c++17 -O2 -shared -fPIC spatial.cpp -o libgeobusiness.so

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/pyproject.toml backend/requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY --from=native_builder /native/libgeobusiness.so /app/native/libgeobusiness.so
COPY backend/app ./app
COPY backend/tests ./tests
RUN pip install --no-cache-dir --no-deps . && useradd --create-home appuser
USER appuser
EXPOSE 8000
# One process keeps the MVP's upstream throttle and IP limits consistent.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]

