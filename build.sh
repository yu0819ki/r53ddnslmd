#!/bin/bash

## initialize
rm -rf ./dist;
mkdir -p ./dist/node_modules

## copy source
cp -r ./package.json ./.env ./.env.example ./src/* ./dist

## install modules
npm install --production --prefix ./dist
rm -rf dist/node_modules/aws-sdk

## packaging
(cd ./dist;zip -rq ./r53ddnslmd.zip ./)
