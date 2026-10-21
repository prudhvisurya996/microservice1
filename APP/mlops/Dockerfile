FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir numpy pandas
COPY anomaly.py stage1.py watch.py ./
ENV LOG_DIR=/var/lib/docker/containers
EXPOSE 8088
CMD ["python3", "-u", "watch.py"]
