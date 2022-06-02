/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npx wrangler dev src/index.js` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npx wrangler publish src/index.js --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { recoverTypedSignature } from '@metamask/eth-sig-util';
import { toChecksumAddress } from 'ethereumjs-util';
import { SignJWT } from 'jose';

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method === "PUT") {
    let data = await request.json();
    let key = data.from;
    let nonces = Math.floor(Math.random() * 1000000)
    await loginKV.put(key, nonces, { expirationTtl: 120 })
    console.log(`${key} has been logged in`)
    return new Response(JSON.stringify({ "nonces": nonces, "key": key }), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } else if (request.method === "OPTIONS") {
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    responseHeaders.set('Access-Control-Max-Age', '86400');
    return new Response("", {
      headers: responseHeaders
    })
  } else {
    const data = await request.json();
    const chainId = data.chainId;
    const from = data.from;
    const nonces = await loginKV.get(from);
    const msgParams = {
      domain: {
        chainId: chainId,
        name: 'Login',
        version: '1'
      },
      message: {
        contents: 'Login',
        nonces: nonces,
      },
      primaryType: 'Login',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
        Login: [
          { name: 'contents', type: 'string' },
          { name: 'nonces', type: 'uint256' },
        ],
      },
    };
    const signature = data.signature;
    const version = "V4";
    const recoveredAddr = recoverTypedSignature({
      data: msgParams,
      signature: signature,
      version: version,
    });
    if (toChecksumAddress(recoveredAddr) === toChecksumAddress(from)) {

      const tokenLogin = await new SignJWT({ "user_id": from })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setExpirationTime('1h')
        .sign(Buffer.from(SECRET_KEY, "utf8"));
      console.log(`${from} has been ${tokenLogin}`)
      return new Response(JSON.stringify({ "verify": true, "token": tokenLogin }), {
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'Access-Control-Allow-Origin': '*'
        },
      });

    } else {
      return new Response(JSON.stringify({ "verify": false }), {
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }
  }

  // const jsonData = JSON.stringify(data, null, 2);
  // console.log(jsonData);
  // return new Response(jsonData, {
  //   headers: {
  //     'content-type': 'application/json;charset=UTF-8',
  //   },
  // });
}