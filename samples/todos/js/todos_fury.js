// Models
var Todo = function (content, done) {
    this.content = ko.observable(content);
    this.done = ko.observable(done);
};

// Service delegate: Amplify (local storage) implementation
var AmplifyTodoService = function () {
    this.load = function(  ) {
        var data = amplify.store( "todos-fury" );
        return data ? data : []
    }

    this.save = function( data ) {
        amplify.store( "todos-fury", data );
    }
}

// Controller
var TodoController = function () {

    // DEPENDENCIES

    // Inject our presentation model and set up any delegated event handler on resolution
    fury.inject( this, "todoPresentationModel", "pm", function() {
        fury.subscribe( "todo.delete", this.pm.todos, this.pm.todos.remove );
        fury.subscribe( "todo.edit", this.pm, this.pm.editedTodo );
        fury.subscribe( "newtodo.content.changed", this.pm, this.pm.resetTooltipTimer );
        fury.subscribe( "todos.clearCompleted", this.pm, this.pm.clearCompleted );
        fury.subscribe( "todos.completeAll", this.pm, this.pm.completeAll );
    } );

    // Inject our service and set up any delegated event handler on resolution
    fury.inject( this, "todoService", "service", function() {
        // When the state of the model changes, save it.
        fury.subscribe( "todos.changed", this.service, this.service.save );
    });

    // EVENT HANDLERS

    // Set up any event listeners in this controller
    fury.subscribe( "application.start", this, function() {
        this.pm.initialize( this.service.load() );
    });

    // Validate and then save a new todo
    fury.subscribe( "todo.submitted", this, function( content ) {
        if ( content.length ) {
            this.pm.todos.push( new Todo( content, false ) );
            $("#new-todo").val( null );

        }
    });

    // When a todo is updated, null out the currently edited todo
    fury.subscribe( "todo.update", this, function ( todo ) {
        this.pm.editedTodo( null );
    });
}

// Presentation Model
var TodoPresentationModel = function() {
    var self = this;

    // DEPENDENCIES

    fury.inject( this, "todoFormatter", "formatter");

    // PROPERTIES

    // "Bindable" properties
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

    // Set up initial state
    self.initialize = function ( todos ) {
        ko.utils.arrayForEach( todos, function( rawTodo ) {
            self.todos.push( new Todo( rawTodo.content, rawTodo.done ));
        });

        ko.computed( self.update );
    }

    // Maintains state of bindable properties whenever a change is detected
    self.update = function () {
        var completedTodos = ko.utils.arrayFilter(self.todos(), function(todo) {
            return todo.done();
        });

        self.completedTodosExist( completedTodos.length > 0 );
        self.remainingTodosExist( self.todos().length - completedTodos.length > 0 );
        self.allTodosAreComplete( completedTodos.length == self.todos().length );
        self.completedLabel( self.formatter.pluralizeCompletedItems( completedTodos.length ) );
        self.remainingLabel( self.formatter.pluralizeRemainingItems( self.todos().length - completedTodos.length ) );

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

// Utilities

var TodoFormatter = function() {
    this.pluralizeRemainingItems = function (count) {
        return count + ( count == 1 ? " item" : " items" );
    }
    this.pluralizeCompletedItems = function (count) {
        return count + ( count == 1 ? " completed item" : " completed items" );
    }
}

// Register dependencies

fury.register({
    todoFormatter : new TodoFormatter(),
    todoPresentationModel : new TodoPresentationModel(),
    todoController : new TodoController(),
    todoService : new AmplifyTodoService()
})

// Let's go.
$(document).ready( function() {
    ko.applyBindings( fury.bean( "todoPresentationModel" ) );
    fury.publish( "application.start" );
})
