(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['backbone', 'underscore', 'marionette'], function (Backbone, _, Marionette) {
            return factory(Backbone, _, Marionette);
        });
    }
    else if (typeof exports !== 'undefined') {
        var Backbone = require('backbone');
        var _ = require('underscore');
        var Marionette = require('marionette');

        module.exports = factory(Backbone, _, Marionette);
    }
    else {
        root.Mn.Modal = factory(root.Backbone, root._, root.Mn);
    }
}.call(this, this, function (Backbone, _, Mn) {
    'use strict';

    var _settings = {
        defaultEffect: 'slideTop'
    };

    var effects = {
        slideTop: 'mn-modal_effect_slide-top',
        fade: 'mn-modal_effect_fade'
    };

    // default model
    var ModalModel = Backbone.Model.extend({
        defaults: {
            isActive: false
        },

        isNew: function () {
            return true;
        }
    });

    // control collection
    var ModalCollection = Backbone.Collection.extend({
        model: ModalModel,

        initialize: function () {
            this.on('destroy', this.onDestroy);
        },

        getActive: function () {
            return this.findWhere({ isActive: true });
        },

        hasActive: function () {
            return this.some(function (model) {
                return model.get('isActive');
            });
        },

        getGroup: function (model) {
            var group = model.get('group');

            if (group !== void 0) {
                return this.where({ group: group });
            }

            return [];
        },

        onDestroy: function (model) {
            var models = this.getGroup(model);

            if (models.length > 0) {
                this.remove(models);
            }

            this.reactivate();
        },

        reactivate: function () {
            if ((this.lastActive !== void 0) && (this.get(this.lastActive) !== void 0)) {
                this.lastActive.set('isActive', true);

                return this;
            }

            var last = this.last();

            if (last !== void 0) {
                last.set('isActive', true);
            }
        }
    });

    // modal
    var ModalView = Mn.LayoutView.extend({
        template: _.template('<div class="js-item-container"></div>'),

        events: {
            'click .js-submit:not(.js-disabled)': 'onSubmit',
            'click .js-reject': 'onReject',
            'click .js-next:not(.js-disabled)': 'onNext',
            'click .js-previous': 'onPrevious'
        },

        className: function () {
            var defaultClass = _settings.defaultClass;
            var effect = this.model.get('effect') || _settings.defaultEffect;
            var _className = 'mn-modal__item ' + effects[effect];
            var className = this.model.get('className');

            if (defaultClass) {
                _className += ' ' + defaultClass;
            }

            if (className) {
                _className += ' ' + className;
            }

            return _className;
        },

        modelEvents: {
            'change:isActive': 'onChangeActive',
            reject: 'onReject',
            submit: 'onSubmit',
            close: 'closeModal'
        },

        regions: {
            contentRegion: '.js-item-container'
        },

        onRender: function () {
            var View = this.model.get('View');

            this.contentRegion.show(new View);
            this.toggle(this.model.get('isActive'));
        },

        toggle: function (state) {
            var el = this.el;

            var effect = this.model.get('effect') || _settings.defaultEffect;
            var effectClass = effects[effect] + '_shown';

            if (state) {
                _.defer(function () {
                    el.classList.add('mn-modal__item_shown', effectClass);
                });
            }
            else {
                el.classList.remove('mn-modal__item_shown', effectClass);
            }
        },

        onChangeActive: function (model, value) {
            this.toggle(value);
        },

        onSubmit: function () {
            var self = this;
            var submitStatus = this.contentRegion.currentView.triggerMethod('submit');

            // prevent closing if onSubmit method of child view returns "false"
            if (submitStatus === false) {
                return;
            }

            Backbone.$.when(submitStatus).done(function () {
                self.closeModal();
            });
        },

        onReject: function () {
            var cancelStatus = this.contentRegion.currentView.triggerMethod('reject');

            // prevent closing if onReject method of child view returns "false"
            if (cancelStatus === false) {
                return;
            }

            this.closeModal();
        },

        onNext: function () {
            var self = this;
            var nextObject = this.contentRegion.currentView.triggerMethod('next');

            if (nextObject === false) {
                return;
            }

            var nextId = nextObject.id;
            var nextStatus = nextObject.promise;

            if (nextStatus) {
                Backbone.$.when(nextStatus).done(function () {
                    self._toggleModal(nextId);
                });
            }
            else {
                this._toggleModal(nextId);
            }
        },

        onPrevious: function () {
            var previousId = this.contentRegion.currentView.triggerMethod('previous');

            this._toggleModal(previousId);
        },

        _toggleModal: function (modalId) {
            // prevent switching modals if methods of child view returns "false"
            if (modalId === false) {
                return;
            }

            var targetModal = this.model.collection.get(modalId);

            if (targetModal === void 0) {
                throw new Mn.Error({
                    message: 'modal dialog with id "' + modalId + '" not found',
                    name: 'ModalException'
                });
            }

            this.model.set('isActive', false);
            targetModal.set('isActive', true);
            this.model.collection.lastActive = targetModal;
        },

        closeModal: function () {
            this.el.classList.remove('mn-modal__item_shown');
            this.model.destroy();
        }
    });

    // modal container
    var ModalContainer = Mn.CollectionView.extend({
        el: '#mn-modal',
        sort: false,
        childView: ModalView,

        toggle: function (state) {
            return this.el.classList.toggle('mn-modal_shown', state);
        }
    });

    // constructor
    var ModalController = function () {
        this.collection = new ModalCollection;

        this.container = new ModalContainer({
            collection: this.collection
        });

        this.container.render();

        this.listenTo(this.container, 'add:child remove:child', this.toggleContainer);
    };

    // controller methods
    _.extend(ModalController.prototype, Backbone.Events, {
        add: function (items) {
            var self = this;

            if (_.isArray(items)) {
                items.forEach(function (item) {
                    self._add(item);
                });
            }
            else {
                this._add(items);
            }
        },

        _add: function (item) {
            if (item.isActive) {
                this.collection.lastActive = this.collection.getActive();

                if (this.collection.lastActive !== void 0) {
                    this.collection.lastActive.set('isActive', false);
                }
            }
            else if (this.collection.length === 0) {
                item.isActive = true;
            }

            this.collection.add(item);
        },

        onReject: function () {
            var activeModal = this.collection.getActive();

            if (activeModal !== void 0) {
                activeModal.trigger('reject');
            }
        },

        onSubmit: function () {
            var activeModal = this.collection.getActive();

            if (activeModal !== void 0) {
                activeModal.trigger('submit');
            }
        },

        toggleContainer: function () {
            this.container.toggle(this.collection.length > 0);
        },

        configure: function (settings) {
            if (settings.EA) {
                this._resetEvents(settings.EA);
            }

            _.extend(_settings, settings);
        },

        _resetEvents: function (EA) {
            if (_settings.EA) {
                this.stopListening(_settings.EA);
            }

            this.listenTo(EA, 'submit', this.onSubmit);
            this.listenTo(EA, 'reject', this.onReject);
        },

        close: function (id) {
            if (id !== void 0) {
                var model = this.collection.get(id);

                if (model !== void 0) {
                    model.trigger('close');
                }
            }
        }
    });

    return ModalController;
}));
