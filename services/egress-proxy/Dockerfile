FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends squid ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY squid.conf /etc/squid/squid.conf
RUN chown root:root /etc/squid/squid.conf && chmod 0444 /etc/squid/squid.conf

EXPOSE 3128
USER proxy
ENTRYPOINT ["/usr/sbin/squid", "-N", "-f", "/etc/squid/squid.conf"]
