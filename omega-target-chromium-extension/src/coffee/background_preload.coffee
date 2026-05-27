window.UglifyJS_NoUnsafeEval = true
localStorage['log'] = ''
localStorage['logLastError'] = ''

window.OmegaContextMenuQuickSwitchHandler = -> null
window.OmegaContextMenuClickHandlers ?= {}
actionContext = if chrome.action? then "action" else "browser_action"
addContextMenu = (options, onclick) ->
  if onclick
    if options.id
      window.OmegaContextMenuClickHandlers[options.id] = onclick
    else
      options.id = 'omega-context-' + Object.keys(
        window.OmegaContextMenuClickHandlers).length
      window.OmegaContextMenuClickHandlers[options.id] = onclick
  chrome.contextMenus.create(options)

if chrome.contextMenus?.onClicked?
  chrome.contextMenus.onClicked.addListener (info, tab) ->
    window.OmegaContextMenuClickHandlers[info.menuItemId]?(info, tab)

if chrome.contextMenus?
  createContextMenus = ->
    # We don't need this API. However its presence indicates that Chrome >= 35
    # which provides info.checked we need in contextMenu callback.
    # https://developer.chrome.com/extensions/contextMenus
    if chrome.i18n.getUILanguage?
      # We must create the menu item here before others to make it first in
      # menu.
      addContextMenu({
        id: 'enableQuickSwitch'
        title: chrome.i18n.getMessage('contextMenu_enableQuickSwitch')
        type: 'checkbox'
        checked: false
        contexts: [actionContext]
      }, (info) -> window.OmegaContextMenuQuickSwitchHandler(info))

  if chrome.contextMenus.removeAll?
    chrome.contextMenus.removeAll(createContextMenus)
  else
    createContextMenus()
