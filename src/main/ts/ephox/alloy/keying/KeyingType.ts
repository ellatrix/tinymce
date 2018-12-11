import { FieldProcessorAdt, FieldSchema, ValueSchema } from '@ephox/boulder';
import { Merger, Option, Arr, Result } from '@ephox/katamari';

import * as EventRoot from '../alien/EventRoot';
import * as Keys from '../alien/Keys';
import { SugarEvent } from '../alien/TypeDefinitions';
import { AlloyComponent } from '../api/component/ComponentApi';
import * as AlloyEvents from '../api/events/AlloyEvents';
import * as NativeEvents from '../api/events/NativeEvents';
import * as SystemEvents from '../api/events/SystemEvents';
import * as FocusManagers from '../api/focus/FocusManagers';
import { BehaviourState } from '../behaviour/common/BehaviourState';
import * as Fields from '../data/Fields';
import { NativeSimulatedEvent } from '../events/SimulatedEvent';
import * as KeyRules from '../navigation/KeyRules';
import { GeneralKeyingConfig, FocusInsideModes } from './KeyingModeTypes';
import { inSet } from '../navigation/KeyMatch';

const typical = <C extends GeneralKeyingConfig, S>(
  infoSchema: FieldProcessorAdt[],
  stateInit: (config: C) => BehaviourState,
  getKeydownRules: (comp: AlloyComponent, se: NativeSimulatedEvent, config: C, state?: S) => Array<KeyRules.KeyRule<C, S>>,
  getKeyupRules: (comp: AlloyComponent, se: NativeSimulatedEvent, config: C, state?: S) => Array<KeyRules.KeyRule<C, S>>,
  optFocusIn: (config: C) => Option<(comp: AlloyComponent, config: C, state: S, evt) => void>) => {
  const schema = () => {
    return infoSchema.concat([
      FieldSchema.defaulted('focusManager', FocusManagers.dom()),
      FieldSchema.defaultedOf('focusInside', 'onFocus', ValueSchema.valueOf((val) => {
        return Arr.contains([ 'onFocus', 'onEnterOrSpace', 'onApi' ], val) ? Result.value(val) : Result.error('Invalid value for focusInside');
      })),
      Fields.output('handler', me),
      Fields.output('state', stateInit),
      Fields.output('sendFocusIn', optFocusIn)
    ]);
  };

  const processKey = (component: AlloyComponent, simulatedEvent: NativeSimulatedEvent, getRules, keyingConfig: C, keyingState?: S): Option<boolean> => {
    const rules = getRules(component, simulatedEvent, keyingConfig, keyingState);

    const isInternal = !EventRoot.isSource(component, simulatedEvent);

    return KeyRules.choose(isInternal, rules, simulatedEvent.event()).bind((rule) => {
      return rule(component, simulatedEvent, keyingConfig, keyingState);
    });
  };

  const toEvents = (keyingConfig: C, keyingState: S): AlloyEvents.AlloyEventRecord => {

    const onFocusHandler = keyingConfig.focusInside !== FocusInsideModes.OnFocusMode ? Option.none() : optFocusIn(keyingConfig).map((focusIn) => {
      return AlloyEvents.run(SystemEvents.focus(), (component, simulatedEvent) => {
        focusIn(component, keyingConfig, keyingState, simulatedEvent);
        simulatedEvent.stop();
      });
    });

    // On enter or space on root element, if using EnterOrSpace focus mode, fire a focusIn on the component
    const tryGoInsideComponent = (component: AlloyComponent, simulatedEvent) => {
      const isEnterOrSpace = inSet(Keys.SPACE().concat(Keys.ENTER()))(simulatedEvent.event());

      if (keyingConfig.focusInside === FocusInsideModes.OnEnterOrSpace && isEnterOrSpace && EventRoot.isSource(component, simulatedEvent)) {
        optFocusIn(keyingConfig).each((focusIn) => {
          focusIn(component, keyingConfig, keyingState, simulatedEvent);
          simulatedEvent.stop();
        });
      }
    }

    return AlloyEvents.derive(
      onFocusHandler.toArray().concat([
        AlloyEvents.run<SugarEvent>(NativeEvents.keydown(), (component, simulatedEvent) => {
          processKey(component, simulatedEvent, getKeydownRules, keyingConfig, keyingState).fold(
            () => {
              // Key wasn't handled ... so see if we should enter into the component (focusIn)
              tryGoInsideComponent(component, simulatedEvent);
            },
            (_) => {
              simulatedEvent.stop();
            }
          );
        }),
        AlloyEvents.run<SugarEvent>(NativeEvents.keyup(), (component, simulatedEvent) => {
          processKey(component, simulatedEvent, getKeyupRules, keyingConfig, keyingState).each((_) => {
            simulatedEvent.stop();
          });
        })
      ])
    );
  };

  const me = {
    schema,
    processKey,
    toEvents
  };

  return me;
};

export {
  typical
};