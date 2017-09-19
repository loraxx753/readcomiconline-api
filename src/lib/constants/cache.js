const CACHE_ENABLED = false;

const CACHE_KEYS = {
  comics: {
    list: "comics\\:letter\\::letter?\\:page\\::page?",
    details: "comics\\:detail\\::name",
    issue: "comics\\:detail\\::name\\::issue"
  },
  publishers: {
    list: "comics\\:publishers\\::name?\\:page\\::page?"
  },
  artists: {
    list: "comics\\:artists\\::name?\\:page\\::page?"
  },
  writers: {
    list: "comics\\:writers\\::name?\\:page\\::page?"
  }
};

export { CACHE_KEYS, CACHE_ENABLED };
