/*
 * Model
 *
 * Instead of [Bindable], we create properties as Knockout Observables
 * Note that we've isolated all knowledge of Knockout within our domain and
 * presentation models:  it's basically acting as a 'bindable model' framework,
 * replacing Flex's [Bindable].
 */
var Todo = function (content, done) {
    this.content = ko.observable(content);
    this.done = ko.observable(done);
};

/*
 * Service Delegate
 *
 * Abstracts out-of-browser dependencies.  In this case,
 * we're hiding the fact that we use the Amplify framework for easy local storage.
 */
var AmplifyTodoService = function () {
    this.load = function(  ) {
        var data = amplify.store( "todos-fury" );
        return data ? data : []
    }

    this.save = function( data ) {
        amplify.store( "todos-fury", data );
    }
}

/*
 * Controller
 *
 * An event-driven, MVC-style Controller.  Responds to events dispatched
 * by the UI, coordinates use of services, and updates both domain and
 * presentation ("view") models.
 *
 * In this example, I'm using the Controller as the sole point of event
 * subscription, but you're free to do whatever you want.  This is a
 * good place to introduce two of the three fury.js functions you
 * should care about:
 *
 * fury.inject( target, bean name, target's property name, callback ) is like [Inject] in Swiz
 * fury.subscribe( some event name, target, target method ) is like [EventHandler] in Swiz
 */
var TodoController = function () {

    // DEPENDENCIES

    /* Presentation model injection: note that it adds event subscriptions on injection
     * (via a callback), but that the event handlers themselves are members of the presentation
     * model.  The PM could handle this subscription directly, but I like having the Controller
     * contain my subscription definitions.
     */
    fury.inject( this, "todoPresentationModel", "pm", function() {
        fury.subscribe( "todo.delete", this.pm.todos, this.pm.todos.remove );
        fury.subscribe( "todo.edit", this.pm, this.pm.editedTodo );
        fury.subscribe( "newtodo.content.changed", this.pm, this.pm.resetTooltipTimer );
        fury.subscribe( "todos.clearCompleted", this.pm, this.pm.clearCompleted );
        fury.subscribe( "todos.completeAll", this.pm, this.pm.completeAll );
    } );

    /* Service injection */
    fury.inject( this, "todoService", "service", function() {
        // When the state of the model changes, save it.
        fury.subscribe( "todos.changed", this.service, this.service.save );
    });

    // EVENT HANDLERS

    /* Set up any subscriptions within this controller */

    /*
     * When the application starts, run this function.  Think [EventHandler] with an
     * anonymous method.
     */
    fury.subscribe( "application.start", this, function() {
        this.pm.initialize( this.service.load() );
    });

    /*
     * When someone submits a Todo, validate and then save via the injected
     * service.
     */
    fury.subscribe( "todo.submitted", this, function( content ) {
        if ( content.length ) {
            this.pm.todos.push( new Todo( content, false ) );
            $("#new-todo").val( null );

        }
    });

    /*
     * When someone finishes editing a todo, change the PM to have
     * no selected todo.
     */
    fury.subscribe( "todo.update", this, function ( todo ) {
        this.pm.editedTodo( null );
    });
}

/*
 * Presentation model
 *
 * It's made "bindable" via Knockout.  Note that we've isolated
 * all knowledge of Knockout within our domain and presentation models:  it's basically
 * acting as a 'bindable model' framework, replacing Flex's [Bindable].
 */
var TodoPresentationModel = function() {
    var self = this;

    // DEPENDENCIES

    fury.inject( this, "todoFormatter", "formatter");

    // PROPERTIES

    /*
     * "Bindable" properties representing the state of our view.  Their
     * names should be descriptive enough to say what they do.
     */
    self.todos = ko.observableArray([]);
    self.completedLabel = ko.observable( "" );
    self.remainingLabel = ko.observable( "" );
    self.remainingTodosExist = ko.observable( true );
    self.completedTodosExist = ko.observable( true );
    self.allTodosAreComplete = ko.observable( true );
    self.editedTodo = ko.observable();
    self.showTooltip = ko.observable( false );
    self.showTooltip.setTrue = function() { self.showTooltip(true); }; //avoid an anonymous function each time

    // METHODS

    // Set up initial state from a list of raw objects
    self.initialize = function ( todos ) {
        // Use knockout to transform the raw objects into Todo instances
        ko.utils.arrayForEach( todos, function( rawTodo ) {
            self.todos.push( new Todo( rawTodo.content, rawTodo.done ));
        });

        // Whenever Knockout sees a change to this model, call update()
        ko.computed( self.update );
    }

    // Refresh the state of our presentation model
    self.update = function () {
        var completedTodos = ko.utils.arrayFilter(self.todos(), function(todo) {
            return todo.done();
        });

        self.completedTodosExist( completedTodos.length > 0 );
        self.remainingTodosExist( self.todos().length - completedTodos.length > 0 );
        self.allTodosAreComplete( completedTodos.length == self.todos().length );
        self.completedLabel( self.formatter.pluralizeCompletedItems( completedTodos.length ) );
        self.remainingLabel( self.formatter.pluralizeRemainingItems( self.todos().length - completedTodos.length ) );

        // Use Fury to tell the world the model has changed
        fury.publish( "todos.changed", ko.toJS( self.todos ) );
    }

    // Clear out all completed todos
    self.clearCompleted = function() {
        self.todos.remove(function(todo) {
            return todo.done();
        });
    }

    // Mark all todos as completed
    self.completeAll = function( complete ) {
        ko.utils.arrayForEach(self.todos(), function(todo) {
            todo.done(complete);
        });
    }

    // Set up the timer to show the help tooltip
    self.resetTooltipTimer = function() {
        self.showTooltip(false);
        self.showTooltip.timer ? clearTimeout(self.showTooltip.timer) : null;
        self.showTooltip.timer = setTimeout(self.showTooltip.setTrue, 1000);
    }
}

/*
 * Utilities
 *
 * Standalone helpers and such intended to be injected as dependencies.
 */

var TodoFormatter = function() {
    this.pluralizeRemainingItems = function (count) {
        return count + ( count == 1 ? " item" : " items" );
    }
    this.pluralizeCompletedItems = function (count) {
        return count + ( count == 1 ? " completed item" : " completed items" );
    }
}


/**
 * fury.js DI configuration
 *
 * This registers beans with Fury's DI engine (think Swiz BeanProvider)
 */
fury.register({
    todoFormatter : new TodoFormatter(),
    todoPresentationModel : new TodoPresentationModel(),
    todoController : new TodoController(),
    todoService : new AmplifyTodoService()
})


/**
 * Hell yes it plays with jQuery, and you should use it in your Controller.
 */
$(document).ready( function() {
    // Ask fury for the todoPresentationModel bean and tell Knockout to watch it for changes
    ko.applyBindings( fury.bean( "todoPresentationModel" ) );

    // Publish the "application.start" message (think dispatchEvent( eventName, data ) )
    fury.publish( "application.start" );
})
