export default {
  namespace: '/comics',
  list: '/:letter(0|[a-z])?/:page(\\d+)?',
  search: '/search/:keyword/:genres([012]{47})?/:status(ongoing|completed)?',
  detail: '/:name',
  issue: '/:name/:issue'
};
