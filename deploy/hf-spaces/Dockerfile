FROM python:3.11-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        nginx \
        libgl1 \
        libglib2.0-0 \
        libxcb1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

COPY server/ $HOME/app/server/
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf $HOME/app/supervisord.conf

RUN mkdir -p /tmp/models /var/log/supervisor /var/lib/nginx /var/log/nginx /run && \
    chown -R user:user /tmp/models /var/log/supervisor /var/lib/nginx /var/log/nginx /run $HOME/app

ENV MODELS_DIR=/tmp/models \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=$HOME/app/server/classify_service

WORKDIR $HOME/app

USER user

EXPOSE 7860

CMD ["supervisord", "-c", "supervisord.conf"]
