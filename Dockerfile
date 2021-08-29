FROM node:10-slim

ADD ./ /usr/src/swpublisher
RUN cd /usr/src/swpublisher && npm --silent --production install

CMD ["node", "/usr/src/swpublisher/src/master.js"]
