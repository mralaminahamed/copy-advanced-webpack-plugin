import Queue from './queue';

export default function limit(concurrency)
{
    if (!((Number.isInteger(concurrency) || concurrency === Infinity) && concurrency > 0)) {
        throw new TypeError('Expected `concurrency` to be a number from 1 and up');
    }

    const queue = new Queue();
    let activeCount = 0;

    const next = () => {
        // eslint-disable-next-line no-plusplus
        activeCount--;

        if (queue.size > 0) {
            queue.dequeue()();
        }
    };

    const run = async(fn, resolve, ...args) => {
        // eslint-disable-next-line no-plusplus
        activeCount++;

        const result = (async() => fn(...args))();

        resolve(result);

        try {
            await result;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e)
        }
        next();
    };

    const enqueue = (fn, resolve, ...args) => {
        queue.enqueue(run.bind(null, fn, resolve, ...args));

        (async() => {
            // This function needs to wait until the next microtask before comparing
            // `activeCount` to `concurrency`, because `activeCount` is updated asynchronously
            // when the run function is dequeued and called. The comparison in the if-statement
            // needs to happen asynchronously as well to get an up-to-date value for `activeCount`.
            await Promise.resolve();

            if (activeCount < concurrency && queue.size > 0) {
                queue.dequeue()();
            }
        })();
    };

    const generator = (fn, ...args) => new Promise(resolve => {
        enqueue(fn, resolve, ...args);
    });

    Object.defineProperties(generator, {
        activeCount: {
            get: () => activeCount
        },
        pendingCount: {
            get: () => queue.size
        },
        clearQueue: {
            value: () => {
                queue.clear();
            }
        }
    });

    return generator;
};
