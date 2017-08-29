define(
  'tinymce.plugins.tablenew.selection.Ephemera',

  [
    'ephox.katamari.api.Fun'
  ],

  function (Fun) {
    var selected = 'data-mce-selected';
    var selectedSelector = 'td[' + selected + '],th[' + selected + ']';
    var firstSelected = 'data-mce-first-selected';
    var firstSelectedSelector = 'td[' + firstSelected + '],th[' + firstSelected + ']';
    var lastSelected = 'data-mce-last-selected';
    var lastSelectedSelector = 'td[' + lastSelected + '],th[' + lastSelected + ']';
    return {
      selected: Fun.constant(selected),
      selectedSelector: Fun.constant(selectedSelector),
      firstSelected: Fun.constant(firstSelected),
      lastSelected: Fun.constant(lastSelected),
      firstSelectedSelector: Fun.constant(firstSelectedSelector),
      lastSelectedSelector: Fun.constant(lastSelectedSelector)
    };
  }
);
