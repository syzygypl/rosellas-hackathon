FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/customer-portal /usr/share/nginx/html

EXPOSE 8080
