import http from 'http';

/**
 * Checks if the Traefik Gateway / Microservice Mesh is reachable on port 5001.
 * Returns true if port 5001 responds (status 200-499), false if connection is refused or timed out.
 */
export const isGatewayReachable = (baseUrl = 'http://localhost:5001') => {
  return new Promise((resolve) => {
    const req = http.get(baseUrl, { timeout: 1000 }, (res) => {
      resolve(true);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => {
      resolve(false);
    });
  });
};

/**
 * Polls an assertion function until it passes or timeout occurs.
 * Replaces flaky fixed sleep() calls in asynchronous distributed tests.
 */
export const waitFor = async (fn, { timeout = 3500, interval = 150 } = {}) => {
  const startTime = Date.now();
  let lastError;

  while (Date.now() - startTime < timeout) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw lastError || new Error(`waitFor timed out after ${timeout}ms`);
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
