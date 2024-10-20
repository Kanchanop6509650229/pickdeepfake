from django.urls import path
from myapp import views

urlpatterns = [
    path('', views.index, name='index'),
    path('detecting/', views.detecting, name='detecting'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('callback/', views.callback, name='callback'),
    path('load_history/', views.load_history, name='load_history'),
    path('delete_history_item/', views.delete_history_item, name='delete_history_item'),
    path('delete_all_history/', views.delete_all_history, name='delete_all_history'),
    path('predict/', views.predict, name='predict'),
    path('check_login_status/', views.check_login_status, name='check_login_status'),
    path('get_initial_prediction_info/', views.get_initial_prediction_info, name='get_initial_prediction_info'),
]   
