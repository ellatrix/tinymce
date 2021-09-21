/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import { Behaviour, Boxes, Docking, Gui, GuiFactory, InlineView, Layout, LayoutInset, NodeAnchorSpec } from '@ephox/alloy';
import { Arr, Fun, Optional } from '@ephox/katamari';
import { Height, SugarBody, SugarElement, Traverse, Width } from '@ephox/sugar';

import Editor from 'tinymce/core/api/Editor';
import { NotificationApi, NotificationManagerImpl, NotificationSpec } from 'tinymce/core/api/NotificationManager';
import Delay from 'tinymce/core/api/util/Delay';

import * as Settings from '../api/Settings';
import { UiFactoryBackstage } from '../backstage/Backstage';
import { Notification } from '../ui/general/Notification';

interface Extras {
  readonly backstage: UiFactoryBackstage;
}

export default (editor: Editor, extras: Extras, uiMothership: Gui.GuiSystem): NotificationManagerImpl => {
  const sharedBackstage = extras.backstage.shared;
  const isStickyToolbar = Settings.isStickyToolbar(editor);
  const isToolbarLocationTop = sharedBackstage.header.isPositionedAtTop();

  const getBehaviours = () => {
    const baseClass = 'tox-notification-dock';
    // Never use docking if sticky toolbars is enabled
    if (isStickyToolbar) {
      return [];
    } else {
      return [
        Docking.config({
          contextual: {
            lazyContext: () => Optional.some(Boxes.box(SugarElement.fromDom(editor.getContentAreaContainer()))),
            fadeInClass: `${baseClass}-fadein`,
            fadeOutClass: `${baseClass}-fadeout`,
            transitionClass: `${baseClass}-transition`
          },
          modes: isToolbarLocationTop ? [ 'top' ] : [ 'bottom' ]
        })
      ];
    }
  };

  const getLayoutDirection = (rel: 'tc-tc' | 'bc-bc' | 'bc-tc' | 'tc-bc') => {
    switch (rel) {
      case 'bc-bc':
        return LayoutInset.south;
      case 'tc-tc':
        return LayoutInset.north;
      case 'tc-bc':
        return Layout.north;
      case 'bc-tc':
      default:
        return Layout.south;
    }
  };

  const reposition = (notifications: NotificationApi[]) => {
    if (notifications.length > 0) {
      Arr.each(notifications, (notification, index) => {
        if (index === 0) {
          notification.moveRel(null, 'banner');
        } else {
          notification.moveRel(notifications[index - 1].getEl(), 'bc-tc');
        }
      })
    }
  };

  const open = (settings: NotificationSpec, closeCallback: () => void): NotificationApi => {
    const hideCloseButton = !settings.closeButton && settings.timeout && (settings.timeout > 0 || settings.timeout < 0);

    const close = () => {
      closeCallback();
      InlineView.hide(notificationWrapper);
    };

    const notification = GuiFactory.build(
      Notification.sketch({
        text: settings.text,
        level: Arr.contains([ 'success', 'error', 'warning', 'warn', 'info' ], settings.type) ? settings.type : undefined,
        progress: settings.progressBar === true,
        icon: Optional.from(settings.icon),
        closeButton: !hideCloseButton,
        onAction: close,
        iconProvider: sharedBackstage.providers.icons,
        translationProvider: sharedBackstage.providers.translate
      })
    );

    const notificationWrapper = GuiFactory.build(
      InlineView.sketch({
        dom: {
          tag: 'div',
          classes: [ 'tox-notifications-container' ]
        },
        lazySink: sharedBackstage.getSink,
        fireDismissalEventInstead: { },
        inlineBehaviours: Behaviour.derive(getBehaviours()),
        ...isToolbarLocationTop ? { } : { fireRepositionEventInstead: { }}
      })
    );

    uiMothership.add(notificationWrapper);

    if (settings.timeout > 0) {
      Delay.setTimeout(() => {
        close();
      }, settings.timeout);
    }

    const getBounds = () => {
      // Notifications shouldn't be bound to displaying within the viewport and can render anywhere inside the document
      const documentElement = Traverse.documentElement(SugarBody.body());
      const bounds = Boxes.bounds(0, 0, Width.get(documentElement), Height.get(documentElement));
      return Optional.some(bounds);
    };

    const refreshDocking = isStickyToolbar ? Fun.noop : () => {
      Docking.refresh(notificationWrapper);
    };

    return {
      close,
      moveTo: (x: number, y: number) => {
        InlineView.showWithinBounds(notificationWrapper, GuiFactory.premade(notification), {
          anchor: {
            type: 'makeshift',
            x,
            y
          }
        }, getBounds);
        refreshDocking();
      },
      moveRel: (element: Element, rel: 'tc-tc' | 'bc-bc' | 'bc-tc' | 'tc-bc' | 'banner') => {
        if (rel !== 'banner') {
          const layoutDirection = getLayoutDirection(rel);
          const nodeAnchor: NodeAnchorSpec = {
            type: 'node',
            root: SugarBody.body(),
            node: Optional.some(SugarElement.fromDom(element)),
            layouts: {
              onRtl: () => [ layoutDirection ],
              onLtr: () => [ layoutDirection ]
            }
          };
          InlineView.showWithinBounds(notificationWrapper, GuiFactory.premade(notification), { anchor: nodeAnchor }, getBounds);
        } else {
          InlineView.showWithinBounds(notificationWrapper, GuiFactory.premade(notification), { anchor: sharedBackstage.anchors.banner() }, getBounds);
        }
        refreshDocking();
      },
      text: (nuText: string) => {
        // check if component is still mounted
        Notification.updateText(notification, nuText);
      },
      settings,
      getEl: () => notification.element.dom,
      progressBar: {
        value: (percent: number) => {
          Notification.updateProgress(notification, percent);
        }
      }
    };
  };

  const close = (notification: NotificationApi) => {
    notification.close();
  };

  const getArgs = (notification: NotificationApi) => {
    return notification.settings;
  };

  return {
    open,
    close,
    reposition,
    getArgs
  };
};
