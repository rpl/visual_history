var colorThief = new ColorThief();

var Node = function(url) {
    this.parent = null;
    this.depth = 0;
    this.max_depth = 0;
    this.url = url;
    this.image_url = null;
    this.title = null;
    this.children = [];
    this.insert = function(url) {
        var node = new Node(url);
        node.depth = this.depth + 1;
        node.parent = this;
        this.children.push(node);
        return node;
    };
    this.current = this;
};

var tabs = {};

chrome.contextMenus.create(
    {
        title: "Push link to tree in background",
        contexts: ["link"],
        onclick: function(info, tab) {
            if (tabs[tab.id] && info.linkUrl) {
                tabs[tab.id].urls[info.linkUrl] = tabs[tab.id].current.insert(info.linkUrl);
                tabs[tab.id].max_depth = Math.max(tabs[tab.id].max_depth, tabs[tab.id].current.depth + 1);
            }
        }
    }
);

chrome.browserAction.onClicked.addListener(function(tab) {
    navigate(tab.id, function(tabId) {
        return 'stay';
    });
});

chrome.runtime.onMessage.addListener(function(message, sender) {
    // navigate to currently selected node
    if (message.key == 'ctrl') exitNavigation(sender.tab.id);
});

chrome.commands.onCommand.addListener(function(command) {
    var fun;
    if (command == 'move-up') fun = up;
    else if (command == 'move-down') fun = down;
    else if (command == 'move-left') fun = left;
    else if (command == 'move-right') fun = right;
    chrome.tabs.query({active: true, windowType: "normal", currentWindow: true}, function(d) {
        navigate(d[0].id, fun);
    });
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    delete tabs[tabId];
});

chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId) {
    onNavigateTo(removedTabId, tabs[addedTabId].url);
    tabs[addedTabId] = tabs[removedTabId];
    delete tabs[removedTabId];
    // printTab(addedTabId);
});

chrome.webNavigation.onCommitted.addListener(function(details) {
    var type = details.transitionType;
    if (tabs[details.tabId] && !tabs[details.tabId].override && tabs[details.tabId].urls[details.url]) {
        console.log("setting current to", details.url, tabs[details.tabId].urls[details.url].url);
        tabs[details.tabId].current = tabs[details.tabId].urls[details.url];
        tabs[details.tabId].current.processId = details.processId;
        return;
    }
    //else if (tabs[details.tabId] && details.transitionQualifiers.indexOf("forward_back") >= 0) {
    //    if (tabs[details.tabId].current.parent && tabs[details.tabId].current.parent.url == details.url) {
    //        tabs[details.tabId].current = tabs[details.tabId].current.parent;
    //        tabs[details.tabId].current.processId = details.processId;
    //        return;
    //    }
    //    else for (var i = 0; i < tabs[details.tabId].current.children.length; i++) {
    //        if (tabs[details.tabId].current.children[i].url == details.url) {
    //            tabs[details.tabId].current = tabs[details.tabId].current.children[i];
    //            tabs[details.tabId].current.processId = details.processId;
    //            return;
    //        }
    //    }
    //}
    else if (tabs[details.tabId] && details.transitionQualifiers.indexOf("client_redirect") >= 0) {
        tabs[details.tabId].current.url = details.url;
        tabs[details.tabId].current.processId = details.processId;
        tabs[details.tabId].urls[details.url] = tabs[details.tabId].current;
        return;
    }
    else {
        switch (type) {
            case 'link':
                break;
            case 'typed':
                break;
            case 'auto_bookmark':
                break;
            case 'auto_subframe':
                return;
            case 'manual_subframe':
                break;
            case 'generated':
                break;
            case 'auto_toplevel':
                return;
            case 'form_submit':
                return;
            case 'reload':
                return;
            case 'keyword':
                return;
            case 'keyword_generated':
                return;
        }
    }
    if (tabs[details.tabId]) tabs[details.tabId].urls[details.url] = tabs[details.tabId].current;
    if (tabs[details.tabId] && tabs[details.tabId].override) tabs[details.tabId].override = false;
    else onNavigateTo(details.tabId, details.url, details.processId);
});

chrome.webNavigation.onCompleted.addListener(function(details) {
    if (tabs[details.tabId]) {
        if (tabs[details.tabId].current.processId == details.processId) {
            // tabs[details.tabId].urls[details.url] = tabs[details.tabId].current;
            chrome.tabs.get(details.tabId, function(tab) {
                if (!chrome.runtime.lastError) {
                    var current = tabs[details.tabId].current;
                    if (!current.icon_url) current.icon_url = tab.favIconUrl;
                    if (tab.title) current.title = tab.title;
                    var img = new Image;
                    //img.onload = function() { current.img_color = colorThief.getColor(img); };
                    //img.src = tab.favIconUrl;
                }
            });
            takeScreenshot(tabs[details.tabId].current);
        }
    }
});

function onNavigateTo(tabId, url, processId) {
    var node;
    console.log("setting current to", url);
    if (tabs[tabId]) {
        node = tabs[tabId].current.insert(url);
        node.processId = processId;
        tabs[tabId].current = node;
        tabs[tabId].urls[url] = node;
        tabs[tabId].max_depth = Math.max(tabs[tabId].max_depth, node.depth);
    }
    else {
        node = new Node(url);
        node.current = node;
        node.processId = processId;
        node.urls = {};
        node.urls[url] = node;
        tabs[tabId] = node;
    }
}

function takeScreenshot(node) {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, function (dataUrl) {
        if (dataUrl) node.icon_url = dataUrl;
    });
}

function up(tab) {
    console.log("setting current to");
    if (tabs[tab] && tabs[tab].current.parent)
        tabs[tab].current = tabs[tab].current.parent;
    return 'up';
}

function down(tab) {
    console.log("setting current to");
    if (tabs[tab] && tabs[tab].current.children.length > 0)
        tabs[tab].current = tabs[tab].current.children[tabs[tab].current.children.length - 1];
    return 'down';
}

function left(tab) {
    console.log("setting current to");
    if (tabs[tab] && tabs[tab].current.parent && tabs[tab].current.parent.children.length > 1) {
        var index = tabs[tab].current.parent.children.indexOf(tabs[tab].current);
        if (index > 0)
            tabs[tab].current = tabs[tab].current.parent.children[index - 1];
    }
    return 'left';
}

function right(tab) {
    console.log("setting current to");
    if (tabs[tab] && tabs[tab].current.parent && tabs[tab].current.parent.children.length > 1) {
        var index = tabs[tab].current.parent.children.indexOf(tabs[tab].current);
        if (index > -1 && index < tabs[tab].current.parent.children.length - 1)
            tabs[tab].current = tabs[tab].current.parent.children[index + 1];
    }
    return 'right';
}

function navigate(tabId, move) {
    move = move(tabId);
    // printTab(tabId);
    var tree = getTree(tabs[tabId], tabs[tabId].current);
    var depth_of_current = tabs[tabId].current.depth;
    var max_depth = tabs[tabId].max_depth;
    chrome.tabs.sendMessage(
        tabId,
        {move: move, tree: tree, depth_of_current: depth_of_current, max_depth: max_depth},
        function() {}
    );
}

function getTree(node, current) {
    if (!node.title) node.title = node.url.substr(0, 30) + '... ';
    var tree = {
        name: node == node.title.length > 40 ? node.title : node.title.substr(0, 30) + '... ',
        url: node == node.url.length > 40 ? node.url : node.url.substr(0, 30) + '... ',
        full_url: node.url,
        image_url: node.image_url,
        icon_url: node.icon_url,
        img_color: node.img_color,
        current: node == current,
        children: []
    };
    for (var i = 0; i < node.children.length; i++) tree.children.push(getTree(node.children[i], current));
    return tree;
}

function exitNavigation(tabId) {
    // navigate current tab to current url
    chrome.tabs.get(tabId, function(tab) {
        if (tab.url != tabs[tab.id].current.url) {
            tabs[tab.id].override = true;
            chrome.tabs.update(tab.id, {url: tabs[tab.id].current.url});
        }
    });
}

function printTab(tabId) {
    formatTab(tabs[tabId], 2, tabs[tabId].current);
    console.log('');
}

function formatTab(tab, indent, current) {
    var base, fill;
    if (tab == current) {
        base = '1';
        fill = new Array(indent - 1).join(' ');
    }
    else {
        base = '';
        fill = new Array(indent).join(' ');
    }
    console.log(base + fill + tab.url.substr(0, 50));
    for (var i = 0; i < tab.children.length; i++) {
        formatTab(tab.children[i], indent + 4, current);
    }
}
